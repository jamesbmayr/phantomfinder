/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"actions-create-ghost": document.querySelector("#actions-create-ghost"),
			"actions-create-hunters": document.querySelector("#actions-create-hunters"),
			"actions-join-code": document.querySelector("#actions-join-code"),
			"actions-join-submit": document.querySelector("#actions-join-submit"),
		}

/*** helpers ***/
	/* showToast */
		const TOAST = {
			beforeFade: 200, // ms
			afterFade: 5000, // ms
			element: null,
			timeout: null
		}

		function showToast(data) {
			try {
				// clear existing countdowns
					if (TOAST.timeout) {
						clearTimeout(TOAST.timeout)
						TOAST.timeout = null
					}

				// append
					if (!TOAST.element) {
						TOAST.element = document.createElement("div")
						TOAST.element.id = "toast"
						TOAST.element.setAttribute("visibility", false)
						TOAST.element.setAttribute("success", false)
						document.body.appendChild(TOAST.element)
					}

				// show
					setTimeout(() => {
						TOAST.element.innerHTML = data.message
						TOAST.element.setAttribute("success", data.success || false)
						TOAST.element.setAttribute("visibility", true)
					}, TOAST.beforeFade)

				// hide
					TOAST.timeout = setTimeout(() => {
						TOAST.element.setAttribute("visibility", false)
					}, TOAST.afterFade)
			} catch (error) {console.log(error)}
		}

	/* sendPost */
		function sendPost(options, callback) {
			try {
				// send data to server
					fetch(location.pathname, {method: "POST", body: JSON.stringify(options)})
						.then(function(response){ return response.json() })
						.then(function(data) {
							callback(data || {success: false, message: "unknown error"})
						})
						.catch(function(error) {
							callback({success: false, message: error})
						})
			} catch (error) {console.log(error)}
		}

	/* receivePost */
		function receivePost(data) {
			try {
				// redirect
					if (data.location) {
						window.location = data.location
						return
					}

				// message
					if (data.message) {
						showToast(data)
					}
			} catch (error) {console.log(error)}
		}

/*** actions ***/
	/* createGame */
		ELEMENTS["actions-create-ghost"]?.addEventListener(  TRIGGERS.click, submitCreateGame)
		ELEMENTS["actions-create-hunters"]?.addEventListener(TRIGGERS.click, submitCreateGame)
		function submitCreateGame(event) {
			try {
				// which
					const team = event.target.closest("button").id == "actions-create-ghost" ? 0 : 1

				// send to server
					sendPost({
						action: "createGame",
						team: team
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* joinGame */
		ELEMENTS["actions-join-submit"]?.addEventListener(TRIGGERS.click, submitJoinGame)
		function submitJoinGame(event) {
			try {
				// get gameid
					const gameId = ELEMENTS["actions-join-code"]?.value.trim().toLowerCase() || null
					if (!gameId || !gameId.length) {
						showToast({success: false, message: "enter a game id"})
						return
					}

				// send to server
					sendPost({
						action: "joinGame",
						gameId: gameId
					}, receivePost)
			} catch (error) {console.log(error)}
		}
