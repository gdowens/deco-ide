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
//http://decowsstaging.herokuapp.com/credentials

import fs from 'fs'
import path from 'path'
import child_process from 'child_process'

import bridge from '../bridge'
import {
  login,
  logout,
} from '../actions/authActions'

import {
  onSuccess,
  onError,
} from '../actions/genericActions'

import AuthConstants from 'shared/constants/ipc/AuthConstants'
const {
  LOGIN,
  LOGOUT,
  RESUME_SESSION,
} = AuthConstants

import WindowManager from '../window/windowManager'
import Logger from '../log/logger'

class AuthHandler {
  register() {
    bridge.on(LOGIN, this.openLogin.bind(this))
    bridge.on(LOGOUT, this.clearCredentials.bind(this))
    bridge.on(RESUME_SESSION, this.storeCredentials.bind(this))
    this._credentials = {}
  }

  openLogin(payload, respond) {
    Logger.info('yep')
    Logger.info(payload.url)
    WindowManager.newAuthWindow(payload.url + ).then((resp) => {
      Logger.info(resp)
      respond(onSuccess(LOGIN))
    })
  }

  clearCredentials(payload, respond) {
    this._credentials = {}
    respond(onSuccess(LOGOUT))
  }

  storeCredentials(payload, respond) {
    this._credentials = payload.credentials
    respond(onSuccess(RESUME_SESSION))
  }
}

const handler = new AuthHandler()
export default handler
