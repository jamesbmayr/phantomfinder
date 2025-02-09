/*** modules ***/
	const HTTP    = require("http")
	const FS      = require("fs")
	const QS      = require("querystring")
	const WS      = require("websocket").server

	const CORE    = require("./node/core")
	const GAME    = require("./node/game")
	const SESSION = require("./node/session")

/*** constants ***/
	const ENVIRONMENT = CORE.getEnvironment()
	const CONSTANTS = CORE.getAsset("constants")

/*** server ***/
	/* server */
		const SERVER = HTTP.createServer(handleRequest)
			SERVER.listen(ENVIRONMENT.port, launchServer)

	/* launchServer */
		function launchServer(error) {
			if (error) {
				CORE.logError(error)
				return
			}
			CORE.logStatus(`listening on port ${ENVIRONMENT.port}`)
		}

	/* handleRequest */
		function handleRequest(REQUEST, RESPONSE) {
			try {
				// collect data
					let data = ""
					REQUEST.on("data", chunk => {
						data += chunk
					})
					REQUEST.on("end", () => {
						parseRequest(REQUEST, RESPONSE, data)
					})
			}
			catch (error) {CORE.logError(error)}
		}

	/* parseRequest */
		function parseRequest(REQUEST, RESPONSE, data) {
			try {
				// get info
					REQUEST.get         = QS.parse(REQUEST.url.split("?")[1]) || {}
					REQUEST.path        = REQUEST.url.split("?")[0].split("/") || []
					REQUEST.url         = REQUEST.url.split("?")[0] || "/"
					REQUEST.post        = data ? JSON.parse(data) : {}
					REQUEST.cookie      = REQUEST.headers.cookie ? QS.parse(REQUEST.headers.cookie.replace(/;\s/g, "&")) : {}
					REQUEST.ip          = REQUEST.headers["x-forwarded-for"] || REQUEST.connection.remoteAddress || REQUEST.socket.remoteAddress || REQUEST.connection.socket.remoteAddress
					REQUEST.contentType = CORE.getContentType(REQUEST.url)
					REQUEST.fileType    = (/[.]([a-zA-Z0-9])+$/).test(REQUEST.url) ? (REQUEST.path[REQUEST.path.length - 1].split(".")[1] || null) : null

				// log it
					if (REQUEST.url !== "/favicon.ico") {
						CORE.logStatus(`${REQUEST.cookie.session || "new"} @ ${REQUEST.ip}\n` + 
							`[${REQUEST.method}] ${REQUEST.path.join("/")}\n` + 
							(   REQUEST.method == "GET" ? JSON.stringify(REQUEST.get) : 
							`{${REQUEST.post.action}: [${Object.keys(REQUEST.post).filter(key => key !== "action").map(key => `"${key}"`).join(", ")}]}`))
					}

				// readSession
					SESSION.readOne(REQUEST, RESPONSE, routeRequest)
			}
			catch (error) {_403(REQUEST, RESPONSE, `unable to ${arguments.callee.name}`)}
		}

	/* routeRequest */
		function routeRequest(REQUEST, RESPONSE) {
			try {
				// get
					if (REQUEST.method == "GET") {
						switch (true) {
							// ping
								case ("/ping" == REQUEST.path.join("/")):
									try {
										RESPONSE.writeHead(200, {"Content-Type": `application/json`})
										RESPONSE.end(JSON.stringify({success: true, timestamp: new Date().getTime()}))
									}
									catch (error) {_403(error)}
								break
								
							// favicon
								case (/\/favicon[.]ico$/).test(REQUEST.url):
								case (/\/icon[.]png$/).test(REQUEST.url):
								case (/\/apple\-touch\-icon[.]png$/).test(REQUEST.url):
								case (/\/apple\-touch\-icon\-precomposed[.]png$/).test(REQUEST.url):
								case (/\/logo[.]png$/).test(REQUEST.url):
									try {
										FS.readFile("./assets/logo.png", (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// css
								case (REQUEST.fileType == "css"):
									try {
										FS.readFile("./css/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// js
								case (REQUEST.fileType == "js"):
									try {
										FS.readFile("./js/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// asset
								case (/[.]([a-zA-Z0-9])+$/).test(REQUEST.url):
									try {
										FS.readFile("./assets/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// home
								case (/^\/?$/).test(REQUEST.url):
									try {
										CORE.renderHTML(REQUEST, "./html/home.html", html => {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(html)
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// game
								case (CONSTANTS.gamePathRegex).test(REQUEST.url):
									try {
										// game id
											REQUEST.gameId = REQUEST.path[REQUEST.path.length - 1]

										// find game
											GAME.readOne(REQUEST, data => {
												if (!data.success) {
													_404(REQUEST, RESPONSE, `game ${gameId} not found`)
													return
												}

												REQUEST.game = data.game
												CORE.renderHTML(REQUEST, "./html/game.html", html => {
													RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
													RESPONSE.end(html)
												})
											})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// data
								case (/^\/data$/).test(REQUEST.url):
									try {
										if (!ENVIRONMENT.debug) {
											_404(REQUEST, RESPONSE)
											return
										}
										CORE.accessDatabase(null, data => {
											REQUEST.method = "POST"
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(JSON.stringify(data, null, 2))
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break


							// other
								default:
									_404(REQUEST, RESPONSE, REQUEST.url)
									return
								break
						}
					}

				// post
					else if (REQUEST.method == "POST" && REQUEST.post.action) {
						switch (REQUEST.post.action) {
							// game
								// createGame
									case "createGame":
										try {
											GAME.createOne(REQUEST, data => {
												RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

								// joinGame
									case "joinGame":
										try {
											GAME.joinOne(REQUEST, data => {
												RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

							// others
								default:
									_403(REQUEST, RESPONSE)
								break
						}
					}

				// others
					else {_403(REQUEST, RESPONSE, "unknown route")}
			}
			catch (error) {_403(REQUEST, RESPONSE, `unable to ${arguments.callee.name}`)}
		}

	/* _302 */
		function _302(REQUEST, RESPONSE, data) {
			CORE.logStatus(`redirecting to ${(data || "/")}`)
			RESPONSE.writeHead(302, {Location: data || "../../../../"})
			RESPONSE.end()
		}

	/* _403 */
		function _403(REQUEST, RESPONSE, data) {
			CORE.logError(data)
			RESPONSE.writeHead(403, {"Content-Type": `application/json`})
			RESPONSE.end(JSON.stringify({success: false, error: data}))
		}

	/* _404 */
		function _404(REQUEST, RESPONSE, data) {
			CORE.logError(data)
			RESPONSE.writeHead(404, {"Content-Type": `text/html; charset=utf-8`})
			CORE.renderHTML(REQUEST, "./html/_404.html", html => {
				RESPONSE.end(html)
			})
		}

/*** socket ***/
	/* socket */
		ENVIRONMENT.ws_config.httpServer = SERVER
		const SOCKET = new WS(ENVIRONMENT.ws_config)
			SOCKET.on("request", handleSocket)
		const CONNECTIONS = {}

	/* handleSocket */
		function handleSocket(REQUEST) {
			try {
				// reject
					if ((REQUEST.origin.replace(/^https?\:\/\//g, "") !== ENVIRONMENT.domain)
					 && (REQUEST.origin !== `http://${ENVIRONMENT.domain}:${ENVIRONMENT.port}`)) {
						CORE.logStatus(`[REJECTED]: ${REQUEST.origin} @ " ${REQUEST.socket._peername.address || "?"}`)
						REQUEST.reject()
						return
					}

				// create connection
					if (!REQUEST.connection) {
						REQUEST.connection = REQUEST.accept(null, REQUEST.origin)
					}

				// parse connection
					parseSocket(REQUEST)
			}
			catch (error) {CORE.logError(error)}
		}

	/* parseSocket */
		function parseSocket(REQUEST) {
			try {
				// get request info
					REQUEST.url     = (REQUEST.httpRequest.headers.host || "") + (REQUEST.httpRequest.url || "")
					REQUEST.path    = REQUEST.httpRequest.url.split("?")[0].split("/") || []
					REQUEST.cookie  = REQUEST.httpRequest.headers.cookie ? QS.parse(REQUEST.httpRequest.headers.cookie.replace(/;\s/g, "&")) : {}
					REQUEST.headers = {}
					REQUEST.headers["user-agent"] = REQUEST.httpRequest.headers["user-agent"]
					REQUEST.headers["accept-language"] = REQUEST.httpRequest.headers["accept-langauge"]
					REQUEST.ip      = REQUEST.connection.remoteAddress || REQUEST.socket._peername.address

				// log it
					CORE.logStatus(`${REQUEST.cookie.session || "new"} @ ${REQUEST.ip}\n` +
						`[WEBSOCKET] ${REQUEST.path.join("/")}`)

				// get session and wait for messages
					SESSION.readOne(REQUEST, null, saveSocket)
			}
			catch (error) {_400(REQUEST, `unable to ${arguments.callee.name}`)}
		}

	/* saveSocket */
		function saveSocket(REQUEST) {
			try {
				// gameId
					const gameId = REQUEST.path[REQUEST.path.length - 1]

				// on connect - save connection & fetch game
					CONNECTIONS[REQUEST.session.id] = REQUEST.connection
					GAME.setConnect(REQUEST, true, sendSocketData)

				// on close
					REQUEST.connection.on("close", reasonCode => {
						closeSocket(REQUEST, reasonCode)
					})

				// on message
					REQUEST.connection.on("message", message => {
						routeSocket(REQUEST, message)
					})
			}
			catch (error) {
				CORE.logError(error)
				_400(REQUEST, `unable to ${arguments.callee.name}`)
			}
		}

	/* closeSocket */
		function closeSocket(REQUEST, reasonCode) {
			try {
				// log
					CORE.logStatus(`${REQUEST.cookie.session} @ ${REQUEST.ip}\n` +
						`[WEBSOCKET] ${REQUEST.path.join("/")}\n` +
						` - disconnected: ${reasonCode}`)

				// remove from connections pool
					if (CONNECTIONS[REQUEST.session.id]) {
						delete CONNECTIONS[REQUEST.session.id]
					}

				// update game
					GAME.setConnect(REQUEST, false, sendSocketData)
			} catch (error) {CORE.logError(error)}
		}

	/* routeSocket */
		function routeSocket(REQUEST, message) {
			try {
				// log
					CORE.logStatus(`${REQUEST.cookie.session} @ ${REQUEST.ip}\n` +
						`[WEBSOCKET] ${REQUEST.path.join("/")}\n` +
						` - message: ${message.utf8Data}`)

				// get post data
					const data = JSON.parse(message.utf8Data)
					if (!data || typeof data !== "object") {
						return
					}
					REQUEST.post = data

				// actions
					switch (REQUEST.post.action) {
						case "quitGame":
							GAME.quitOne(REQUEST, sendSocketData)
						break
						case "updateGame":
							GAME.updateOne(REQUEST, sendSocketData)
						break
						case "rematchGame":
							GAME.rematchOne(REQUEST, sendSocketData)
						break
						default: 
							sendSocketData({success: false, message: `invalid action ${REQUEST.post.action || "[none]"}`, recipients: [REQUEST.session.id]})
						break
					}
			}
			catch (error) {
				CORE.logError(error)
				_400(REQUEST, `unable to ${arguments.callee.name}`)
			}
		}

	/* sendSocketData */
		function sendSocketData(data) {
			try {
				// recipients
					const recipients = data.recipients.slice() || []
					if (!recipients.length) {
						return
					}
					delete data.recipients

				// data
					const stringifiedData = JSON.stringify(data)

				// loop through recipients
					for (const recipient of recipients) {
						try {
							if (CONNECTIONS[recipient]) {
								CONNECTIONS[recipient].sendUTF(stringifiedData)
							}
						} catch (error) {CORE.logError(error)}
					}
			}
			catch (error) {CORE.logError(error)}
		}

	/* _400 */
		function _400(REQUEST, data) {
			CORE.logError(data)
			REQUEST.connection.sendUTF(JSON.stringify({success: false, message: (data || "unknown websocket error")}))
		}
