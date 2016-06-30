/**
 *    Copyright (C) 2015 Deco Software Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

"use strict";

var fs = require('fs');
var path = require('path');

var BrowserWindow = require('electron').BrowserWindow; // Module to create native browser window.
var dialog = require('electron').dialog;
var nativeImage = require('electron').nativeImage;
var app = require('electron').app;
var session = require('electron').session;

var Logger = require('../log/logger');

global.preferencesWindow = null
var upgradeWindow = null

import _ from 'lodash'
import bridge from '../bridge'
import fileHandler from '../handlers/fileHandler'
import projectHandler from '../handlers/projectHandler'

import { INFO, QUESTION, } from '../constants/DecoDialog'

import upgradeHandler from '../handlers/upgradeHandler'
import {
  PUBLIC_FOLDER,
  APP_SUPPORT,
  TEMP_PROJECT_FOLDER,
} from '../constants/DecoPaths'

const intializeMainWindow = (browserWindow) => {

  browserWindow.hide();
  browserWindow.setTitle('Deco');
  browserWindow.loadURL(WindowManager.getProjectBaseURL());

  var id = new Date().getTime().toString();
  global.openWindows[id] = browserWindow;

  browserWindow.on('close', (e) => {
    if (!WindowManager.userWantsToClose()) {
      e.preventDefault()
    }
  })

  // Emitted when the window is closed.
  browserWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    delete global.openWindows[id]
    if (global.preferencesWindow) {
      global.preferencesWindow.destroy()
      global.preferencesWindow = null
    }
  })
}

var WindowManager = {
  getProjectBaseURL: function () {
    var localFile = path.join(PUBLIC_FOLDER, '/index.html')
    if (global.__DEV__) {
      return 'http://0.0.0.0:8080/'
    } else {
      return 'file://' + localFile
    }
  },
  allWindowsClosed: function() {
    return _.keys(global.openWindows).length == 0
  },
  userWantsToClose: function() {
    const watchedPath = fileHandler.getWatchedPath()
    if (watchedPath == TEMP_PROJECT_FOLDER) {
      return dialog.showMessageBox(QUESTION.shouldLoseTemporaryDirectory) == 0
    }
    if (projectHandler.hasUnsavedProgress()) {
      return dialog.showMessageBox(QUESTION.shouldLoseUnsavedProgress) == 0
    }

    return true
  },
  checkNeedsUpgrade: function(version) {
    return new Promise((resolve, reject) => {
      if (upgradeHandler.needsUpgrade()) {
        upgradeWindow = new BrowserWindow({
          width: 475,
          height: 178,
          show: false,
          resizable: false,
          frame: false,
          title: 'Deco Upgrade',
          titleBarStyle: 'hidden',
          closable: 'false',
          icon: path.join(PUBLIC_FOLDER, '/images/deco-icon.png'),
        })

        upgradeWindow.setMinimizable(false)
        upgradeWindow.setMaximizable(false)
        upgradeWindow.setFullScreenable(false)

        upgradeWindow.loadURL(WindowManager.getProjectBaseURL() + '#/upgrading')
        var id = new Date().getTime().toString();
        global.openWindows[id] = upgradeWindow;

        upgradeWindow.webContents.on('did-finish-load', function() {
          upgradeWindow.show()
          upgradeHandler.upgrade()
          .then(() => {
            setTimeout(() => {
              resolve()
              upgradeWindow.close()
              delete global.openWindows[id]
            }, 5000)
          })
          .catch(() => {
            setTimeout(reject, 5000)
          })
        })
      } else {
        resolve()
      }
    })
  },
  newAuthWindow: function(authUrl, width, height) {
    return new Promise((resolve, reject) => {
      const authJSONRegex = /\{.*\}/
      try {
        const browserWindow = new BrowserWindow({
          width: width || 1020,
          height: height || 620,
          icon: path.join(PUBLIC_FOLDER, '/images/deco-icon.png'),
        })

        let didRespond = false
        const onDone = (event) => {
          try {
            global.openWindows[id].hide()
            global.openWindows[id].webContents.executeJavaScript(`document.body.innerHTML`, true, (result) => {
              try {
                const match = result.match(authJSONRegex)
                if (match) {
                  resolve(JSON.parse(match[0]))
                } else {
                  reject()
                }
              } catch (e) {
                reject()
              } finally {
                didRespond = true
                global.openWindows[id].destroy()
              }
            })
          } catch (e) {
            reject()
          }
        }

        browserWindow.setTitle('Authorize Deco')
        browserWindow.loadURL(authUrl)
        browserWindow.show()

        var id = new Date().getTime().toString();
        global.openWindows[id] = browserWindow;

        browserWindow.webContents.on('did-get-response-details', function(event, status, newUrl, originalUrl) {
          if (newUrl.indexOf('http://decowsstaging.herokuapp.com/credentials?code') != -1) {
            onDone(event)
          }
        })

        browserWindow.on('closed', () => {
          // Dereference the window object, usually you would store windows
          // in an array if your app supports multi windows, this is the time
          // when you should delete the corresponding element.
          if (!didRespond) {
            reject()
          }
          delete global.openWindows[id]
        })

      } catch (e) {
        Logger.error(e)
        if (browserWindow) {
          browserWindow.destroy()
        }
        didRespond = true
        reject()
      }
    })
  },
  newWindow: function (width, height, show) {
    return new Promise((resolve, reject) => {
      try {
        session.defaultSession.cookies.remove('https://github.com/', 'user_session', () => {
          Logger.info('done')
          session.defaultSession.cookies.get({}, (err, cookies) => {
            Logger.info(JSON.stringify(cookies))
          })
        })
      } catch (e) {
        Logger.error(e)
      }
      var browserWindow = new BrowserWindow({
        width: width || global.workArea.width,
        height: height || global.workArea.height,
        show: show || true,
        titleBarStyle: 'hidden',
        icon: path.join(PUBLIC_FOLDER, '/images/deco-icon.png')
      });

      intializeMainWindow(browserWindow);

      browserWindow.webContents.on('did-finish-load', function() {
        resolve()
        browserWindow.show()
      })
    })
  },
  hidePreferencesWindow: function() {
    preferencesWindow.hide()
  },

  openPreferencesWindow: function() {
    if (global.preferencesWindow) {
      global.preferencesWindow.show()
    }
  },
  initializePreferencesWindow: function() {

    // Retain reference
    var preferencesWindow = new BrowserWindow({
      width: 450,
      height: 360,
      show: false,
      title: 'Preferences',
      titleBarStyle: 'hidden',
      icon: path.join(PUBLIC_FOLDER, '/images/deco-icon.png')
    });

    preferencesWindow.setMinimizable(false)
    preferencesWindow.setMaximizable(false)
    preferencesWindow.setFullScreenable(false)

    preferencesWindow.loadURL(WindowManager.getProjectBaseURL() + '#/preferences');
    preferencesWindow.on('close', (e) => {
      e.preventDefault()
      preferencesWindow.hide()
    })

    global.preferencesWindow = preferencesWindow
    return preferencesWindow
  },
};

module.exports = WindowManager;
