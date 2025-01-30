/*** modules ***/
	const CORE = require("../node/core")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** REQUEST / RESPONSE ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, RESPONSE, callback) {
			try {
				// session
					const session = CORE.getSchema("session")
						session.info.ip = REQUEST.ip
						session.info["user-agent"] = REQUEST.headers["user-agent"]
						session.info.language = REQUEST.headers["accept-language"]

				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "insert"
						query.document = session

				// insert
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							CORE.logError(results.message)
							return
						}

						REQUEST.session = session
						REQUEST.cookie.session = session.id
						callback(REQUEST, RESPONSE)
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* readOne */
		module.exports.readOne = readOne
		function readOne(REQUEST, RESPONSE, callback) {
			try {
				// asset / ping
					if (REQUEST.fileType || (/^\/ping\/?$/).test(REQUEST.url)) {
						callback(REQUEST, RESPONSE)
						return
					}

				// no cookie --> new session
					if (!REQUEST.cookie.session) {
						createOne(REQUEST, RESPONSE, callback)
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "find"
						query.filters = {id: REQUEST.cookie.session}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							REQUEST.session = REQUEST.cookie.session = null
							readOne(REQUEST, RESPONSE, callback)
							return
						}

						// update
							REQUEST.session = results.documents[0]
							updateOne(REQUEST, RESPONSE, callback)
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* updateOne */
		module.exports.updateOne = updateOne
		function updateOne(REQUEST, RESPONSE, callback) {
			try {
				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "update"
						query.filters = {id: REQUEST.session.id}
						query.document = {
							updated: new Date().getTime()
						}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							REQUEST.session = REQUEST.cookie.session = null
							readOne(REQUEST, RESPONSE, callback)
							return
						}

						// results
							REQUEST.session = results.documents[0]
							REQUEST.cookie.session = results.documents[0].id
							callback(REQUEST, RESPONSE)
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** OTHER ***/
	/* setGame */
		module.exports.setGame = setGame
		function setGame(sessionId, gameId, callback) {
			try {
				// validate
					if (!sessionId) {
						callback({success: false, message: `unable to set game for ${sessionId}`})
						return
					}

				// invalid gameId
					if (gameId && !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "update"
						query.filters = {id: sessionId}
						query.document = {
							updated: new Date().getTime(),
							gameId: gameId
						}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to set game id`})
							return
						}

						callback({success: true})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
