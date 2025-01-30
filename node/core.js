/*** modules ***/
	const FS     = require("fs")
	module.exports = {}

/*** environment ***/
	const ENVIRONMENT = getEnvironment()

/*** logs ***/
	/* logError */
		module.exports.logError = logError
		function logError(error) {
			if (ENVIRONMENT.debug) {
				console.log(`\n*** ERROR @ ${new Date().toLocaleString()} ***`)
				console.log(` - ${error}`)
				console.dir(arguments)
			}
		}

	/* logStatus */
		module.exports.logStatus = logStatus
		function logStatus(status) {
			if (ENVIRONMENT.debug) {
				console.log(`\n--- STATUS @ ${new Date().toLocaleString()} ---`)
				console.log(` - ${status}`)
			}
		}

	/* logMessage */
		module.exports.logMessage = logMessage
		function logMessage(message) {
			if (ENVIRONMENT.debug) {
				console.log(` - ${new Date().toLocaleString()}: ${message}`)
			}
		}

	/* logTime */
		module.exports.logTime = logTime
		function logTime(flag, callback) {
			if (ENVIRONMENT.debug) {
				const before = process.hrtime()
				callback()

				const after = process.hrtime(before)[1] / 1e6
				if (after > 10) {
					logMessage(`${flag} ${after}`)
				}
				else {
					logMessage(`.`)
				}
			}
			else {
				callback()
			}
		}

/*** maps ***/
	/* getEnvironment */
		module.exports.getEnvironment = getEnvironment
		function getEnvironment() {
			try {
				// univeral
					const universal = {
						db_cache: {
							sessions: {},
							games:    {}
						},
						ws_config: {
							autoAcceptConnections: false
						}
					}

				// hosted
					if (process.env.DOMAIN !== undefined) {
						return {
							port:        process.env.PORT,
							domain:      process.env.DOMAIN,
							debug:       process.env.DEBUG || false,
							...universal
						}
					}
				
				// local
					return {
						port:            3000,
						domain:          "localhost",
						debug:           true,
						...universal
					}
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* getContentType */
		module.exports.getContentType = getContentType
		function getContentType(string) {
			try {
				const array = string.split(".")
				const extension = array[array.length - 1].toLowerCase()

				switch (extension) {
					// application
						case "json":
						case "pdf":
						case "rtf":
						case "xml":
						case "zip":
							return `application/${extension}`
						break

					// font
						case "otf":
						case "ttf":
						case "woff":
						case "woff2":
							return `font/${extension}`
						break

					// audio
						case "aac":
						case "midi":
						case "wav":
							return `audio/${extension}`
						break
						case "mid":
							return "audio/midi"
						break
						case "mp3":
							return "audio/mpeg"
						break
						case "oga":
							return "audio/ogg"
						break
						case "weba":
							return "audio/webm"
						break

					// images
						case "iso":
						case "bmp":
						case "gif":
						case "jpeg":
						case "png":
						case "tiff":
						case "webp":
							return `image/${extension}`
						break
						case "jpg":
							return "image/jpeg"
						break
						case "svg":
							return "image/svg+xml"
						break
						case "tif":
							return "image/tiff"
						break

					// video
						case "mpeg":
						case "webm":
							return `video/${extension}`
						break
						case "ogv":
							return "video/ogg"
						break

					// text
						case "css":
						case "csv":
						case "html":
							return `text/${extension}; charset=utf-8`
						break
						case "js":
							return "text/javascript; charset=utf-8"
						break
						case "md":
							return "text/html; charset=utf-8"
						break
						case "txt":
						default:
							return "text/plain; charset=utf-8"
						break
				}
			}
			catch (error) {logError(error)}
		}

	/* getSchema */
		module.exports.getSchema = getSchema
		function getSchema(index) {
			try {
				switch (index) {
					// core
						case "query":
							return {
								collection: null,
								command:    null,
								filters:    null,
								document:   null,
								options:    {}
							}
						break

						case "session":
							return {
								id:               generateRandom(),
								updated:          new Date().getTime(),
								gameId:           null,
								info: {
									"ip":         null,
									"user-agent": null,
									"language":   null
								}
							}
						break

					// game
						case "game":
							return {
								id:               generateRandom({length: getAsset("constants").gameIdLength}),
								creatorId:        null,
								updated:          new Date().getTime(),
								timeStart:        0,
								timeEnd:          0,
								width:            getAsset("constants").boardSize, // squares
								height:           getAsset("constants").boardSize, // squares
								obstacles:        [],
								pieces:           [],
								turn:             getAsset("constants").teamGhost, // id
								capture:          false,
								deaths:           0,
								winner:           null,
								players:          {}
							}
						break

						case "player":
							return {
								sessionId: null,
								connected: false,
								team:      null
							}
						break

						case "piece":
							return {
								x:    null,
								y:    null,
								team: null
							}
						break

					// other
						default:
							return null
						break
				}
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* getAsset */
		module.exports.getAsset = getAsset
		function getAsset(index) {
			try {
				switch (index) {
					// web
						case "title":
							return `PhantomFinder`
						break
						case "logo":
							return `<link rel="shortcut icon" href="data:image/svg+xml,<svg viewBox='20 20 60 60' xmlns='http://www.w3.org/2000/svg'><path fill='${getAsset("colors")["medium-red"].replace("#", "%23")}' d='${getAsset("svg").ghost}'></path></svg>">`
						break
						case "description":
							return `an asymmetrical board game for two players: ghost and ghost hunters`
						break
						case "meta":
							const title = getAsset("title")
							const description = getAsset("description")
							return `<meta charset="UTF-8"/>\n
									<meta name="description" content="${title}: ${description}"/>\n
									<meta name="author" content="James Mayr"/>\n
									<meta property="og:title" content="${title}"/>\n
									<meta property="og:description" content="${title}: ${description}"/>\n
									<meta property="og:image" content="https://jamesmayr.com/${title.toLowerCase()}/banner.png"/>\n
									<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0"/>`
						break
						case "fonts":
							return `<link href="https://fonts.googleapis.com/css2?family=Metal+Mania&family=Smooch+Sans:wght@100..900&display=swap" rel="stylesheet">`
						break
						case "css-variables":
							// output
								const cssVariables = []

							// colors
								const colors = getAsset("colors")
								for (const i in colors) {
									cssVariables.push(`--${i}: ${colors[i]};`)
								}

							// sizes
								const sizes = getAsset("sizes")
								for (const i in sizes) {
									cssVariables.push(`--${i}: ${sizes[i]}px;`)
								}

							// other styling
								const styling = getAsset("styling")
								for (const i in styling) {
									cssVariables.push(`--${i}: ${styling[i]};`)
								}

							// fonts
								const fontString = getAsset("fonts")
								const fontNames = fontString.slice(fontString.indexOf("family=") + "family=".length, fontString.indexOf("&display=")).split("&family=")
								for (const index in fontNames) {
									const font = fontNames[index].replace(/\+/g, " ").split(":")[0]
									cssVariables.push(`--font-${index}: "${font}", sans-serif;`)
								}

							// svg paths
								const svgPaths = getAsset("svg")
								for (const pathName in svgPaths) {
									cssVariables.push(`--svg-${pathName}: "${svgPaths[pathName]}";`)
								}

							// return
								return `<style>:root {\n${cssVariables.join("\n")}\n}</style>`
						break

					// styling
						case "colors":
							return {
								"light-gray": "#dddddd",
								"medium-light-gray": "#888888",
								"medium-dark-gray": "#444444",
								"dark-gray": "#111111",
								"light-blue": "#04b1ff",
								"medium-blue": "#0066aa",
								"dark-blue": "#003377",
								"medium-red": "#d94c4c"
							}
						break
						case "sizes":
							return {
								"shadow-size": 10,
								"border-radius": 20,
								"border-size": 3,
								"gap-size": 5,
								"font-size": 20,
								"max-content-size": 800,
								"sidebar-width": 350
							}
						break
						case "styling":
							return {
								"line-height": 1,
								"transition-time": "0.5s",
								"board-rows": 8,
								"board-columns": 8,
								"piece-ratio": "80%"
							}
						break

					// svg
						case "svg":
							return {
								"ghost": "M 54 40 C 54 42 56 44 58 44 C 60 44 62 42 62 40 C 62 38 60 36 58 36 C 56 36 54 38 54 40 Z M 38 40 C 38 42 40 44 42 44 C 44 44 46 42 46 40 C 46 38 44 36 42 36 C 40 36 38 38 38 40 Z M 36 70 C 36 70 34 75 34 75 C 32 80 32 80 31 75 C 30 70 30 60 30 40 C 30 29 39 20 50 20 C 61 20 70 29 70 40 C 70 60 70 70 69 75 C 68 80 68 80 66 75 C 66 75 64 70 64 70 C 62 65 62 65 60 70 C 60 70 58 75 58 75 C 56 80 56 80 54 75 C 54 75 52 70 52 70 C 50 65 50 65 48 70 C 48 70 48 70 46 75 C 44 80 44 80 42 75 C 42 75 40 70 40 70 C 38 65 38 65 36 70 Z",
								"hunter": "M 47 40 C 43 38 40 35 40 30 C 40 24 44 20 50 20 C 56 20 60 24 60 30 C 60 35 57 38 53 40 C 53 41 53 41 53 42 C 56 42 57 42 60 42 C 64 42 72 50 75 53 C 78 56 73 61 70 58 C 67 55 62 50 60 50 C 60 55 60 83 60 86 C 60 88 58 90 56 90 C 54 90 52 88 52 86 C 52 83 52 73 52 70 C 51 70 49 70 48 70 C 48 73 48 83 48 86 C 48 88 46 90 44 90 C 42 90 40 88 40 86 C 40 83 40 55 40 50 C 38 50 33 55 30 58 C 27 61 22 56 25 53 C 28 50 36 42 40 42 C 43 42 44 42 47 42 C 47 41 47 41 47 40 Z",
								"chevron-right": "M 80 50 C 60 60 40 70 20 80 C 25 65 25 65 30 50 C 25 35 25 35 20 20 C 40 30 60 40 80 50 Z",
								"chevron-left": "M 20 50 C 40 40 60 30 80 20 C 75 35 75 35 70 50 C 75 65 75 65 80 80 C 60 70 40 60 20 50 Z",
								"tombstone": "M 30 78 C 30 60 30 50 30 40 C 30 29 39 20 50 20 C 61 20 70 29 70 40 C 70 50 70 60 70 78 C 70 80 70 80 68 80 C 60 80 40 80 32 80 C 30 80 30 80 30 78 Z",
							}
						break

					// constants
						case "constants":
							return {
								idSet: "abcdefghijklmnopqrstuvwxyz",
								idLength: 16, // characters
								gameIdLength: 4, // charactes
								gamePathRegex: /^\/game\/[a-z]{4}$/,
								playerCount: 2, // players
								teamGhost: 0, // id
								teamHunters: 1, // id
								boardSize: 8, // squares
								obstacleCount: 5, // squares
								simultaneousHunters: 4, // pieces
								hunterDeathGoal: 4, // pieces
							}
						break

					// other
						default:
							return null
						break
				}
			}
			catch (error) {
				logError(error)
				return null
			}
		}

/*** tools ***/
	/* convertTime */
		module.exports.convertTime = convertTime
		function convertTime(seconds) {
			try {
				if (isNaN(seconds)) {
					return seconds
				}

				return `${Math.floor(seconds / 60)}:${('00' + Math.floor(seconds % 60)).slice(-2)}`
			} catch (error) {
				logError(error)
				return seconds
			}
		}

	/* renderHTML */
		module.exports.renderHTML = renderHTML
		function renderHTML(REQUEST, path, callback) {
			try {
				const html = {}
				FS.readFile(path, "utf8", (error, file) => {
					if (error) {
						logError(error)
						callback(``)
						return
					}

					html.original = file
					html.array = html.original.split(/<script\snode>|<\/script\snode>/gi)

					for (html.count = 1; html.count < html.array.length; html.count += 2) {
						try {
							html.temp = eval(html.array[html.count])
						}
						catch (error) {
							html.temp = ""
							logError(`${path}: <sn>${Math.ceil(html.count / 2)}</sn>\n${error}`)
						}
						html.array[html.count] = html.temp
					}

					callback(html.array.join(""))
				})
			}
			catch (error) {
				logError(error)
				callback(``)
			}
		}

	/* constructHeaders */
		module.exports.constructHeaders = constructHeaders
		function constructHeaders(REQUEST) {
			try {
				// asset
					if (REQUEST.method == "GET" && (REQUEST.fileType || !REQUEST.session)) {
						return {"Content-Type": REQUEST.contentType}
					}

				// get
					if (REQUEST.method == "GET") {
						const currentTime = new Date().getTime()
						const cookieLength = getAsset("constants").cookieLength
						const expiration = new Date(currentTime + cookieLength).toUTCString()
						return {
							"Set-Cookie": `session=${REQUEST.session.id}; expires=${expiration}; path=/; domain=${ENVIRONMENT.domain}; SameSite=Strict;`,
							"Content-Type": `text/html; charset=utf-8`
						}
					}

				// post
					return {"Content-Type": `application/json`}
			}
			catch (error) {
				logError(error)
				return {"Content-Type": `application/json`}
			}
		}

	/* duplicateObject */
		module.exports.duplicateObject = duplicateObject
		function duplicateObject(obj) {
			try {
				if (typeof obj !== "object") {
					return obj
				}

				return JSON.parse(JSON.stringify(obj))
			} catch (error) {
				logError(error)
				return obj
			}
		}

	/* chooseRandom */
		module.exports.chooseRandom = chooseRandom
		function chooseRandom(list) {
			try {
				// array
					if (Array.isArray(list)) {
						return list[Math.floor(Math.random() * list.length)]	
					}

				// object
					if (typeof list == "object") {
						return list[chooseRandom(Object.keys(list))]
					}

				// string
					if (typeof list == "string") {
						return chooseRandom(list.split(""))
					}

				// other
					return list
			}
			catch (error) {
				logError(error)
				return list
			}
		}

	/* sortRandom */
		module.exports.sortRandom = sortRandom
		function sortRandom(list) {
			try {
				if (!Array.isArray(list)) {
					return list
				}
				
				const listCopy = duplicateObject(list)

				let x = listCopy.length
				while (x > 0) {
					const y = Math.floor(Math.random() * x)
					x -= 1
					const temp = listCopy[x]
					listCopy[x] = listCopy[y]
					listCopy[y] = temp
				}

				return listCopy
			}
			catch (error) {
				logError(error)
				return list
			}
		}

	/* generateRandom */
		module.exports.generateRandom = generateRandom
		function generateRandom(options) {
			try {
				const CONSTANTS = getAsset("constants")
				const set    = options && options.set    ? options.set    : CONSTANTS.idSet
				const length = options && options.length ? options.length : CONSTANTS.idLength

				return new Array(length).fill(null).map(slot => chooseRandom(set)).join("")
			}
			catch (error) {
				logError(error)
				return null
			}
		}

/*** database ***/
	/* documentMeetsFilter */
		module.exports.meetsFilters = meetsFilters
		function meetsFilters(document, filters) {
			try {
				// loop through filters
					for (const property in filters) {
						const filterValue = filters[property]
						
						if (filterValue instanceof RegExp) {
							if (!filterValue.test(document[property])) {
								return false
							}
						}
						else {
							if (filterValue !== document[property]) {
								return false
							}
						}
					}

				// still here --> true
					return true
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* accessDatabase */
		module.exports.accessDatabase = accessDatabase
		function accessDatabase(query, callback) {
			try {
				// no query?
					if (!query) {
						if (ENVIRONMENT.debug) {
							callback({success: true, documents: ENVIRONMENT.db_cache})
							return
						}

						callback({success: false, message: `no query provided`})
						return
					}

				// log
					logMessage(`db:${query.command} ${query.collection}` + 
						(query.filters  ? `\n   > ${JSON.stringify(query.filters) }` : "") +
						(query.document ? `\n   > ${Object.keys(query.document).join(", ")}` : ""))

				// no database?
					if (!ENVIRONMENT.db_cache) {
						logError(`database not found`)
						callback({success: false, message: `database not found`})
						return
					}

				// collection
					if (!ENVIRONMENT.db_cache[query.collection]) {
						logError(`collection not found`)
						callback({success: false, message: `collection not found`})
						return
					}

				// find
					if (query.command == "find") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documentKeys
							if (!documentKeys.length) {
								callback({success: false, count: 0, documents: []})
								return
							}

						// get documents
							const documents = documentKeys.map(key => duplicateObject(ENVIRONMENT.db_cache[query.collection][key]))

						// confirmation
							callback({success: true, count: documents.length, documents: documents})
							return
					}

				// insert
					if (query.command == "insert") {
						// unique id
							let id = null
							do {
								id = generateRandom()
							}
							while (ENVIRONMENT.db_cache[query.collection][id])

						// insert document
							ENVIRONMENT.db_cache[query.collection][id] = duplicateObject(query.document)

						// confirmation
							callback({success: true, count: 1, documents: [query.document]})
							return
					}

				// update
					if (query.command == "update") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documentKeys
							if (!documentKeys.length) {
								callback({success: false, count: 0, documents: []})
								return
							}

						// fields to update
							const updateKeys = Object.keys(query.document)

						// update documents
							for (const key of documentKeys) {
								const document = ENVIRONMENT.db_cache[query.collection][key]

								for (const pathString of updateKeys) {
									const pathList = pathString.split(".")
									
									let subdocument = document
									let level = 0
									while (level < pathList.length - 1) {
										if (typeof subdocument[pathList[level]] == "undefined") {
											subdocument[pathList[level]] = {}
										}
										subdocument = subdocument[pathList[level]]
										level++
									}
									
									if (query.document[pathString] === undefined) {
										delete subdocument[pathList[level]]
									}
									else {
										subdocument[pathList[level]] = query.document[pathString]
									}
								}
							}

						// get updated documents
							const documents = documentKeys.map(key => duplicateObject(ENVIRONMENT.db_cache[query.collection][key]))

						// confirmation
							callback({success: true, count: documents.length, documents: documents})
							return
					}

				// delete
					if (query.command == "delete") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documents
							if (!documentKeys.length) {
								callback({success: false, count: 0})
							}

						// delete
							for (const key of documentKeys) {
								delete ENVIRONMENT.db_cache[query.collection][key]
							}

						// confirmation
							callback({success: true, count: documentKeys.length})
							return
					}
			}
			catch (error) {
				logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
