/**
 * The IRCd config
 */
const config = {
	/**
	 * The host to bind to
	 */
	host: '127.0.0.1',
	/**
	 * The port to bind to
	 */
	port: 6667,

	/**
	 * The server hostname to display
	 */
	hostname: 'anonymous.anon',

	/**
	 * The network name to send to clients
	 */
	networkName: 'AnonIRC',

	/**
	 * The main channel
	 */
	channel: '#anon',

	/**
	 * The main channel's topic text
	 */
	channelTopic: 'Welcome to the AnonIRCd',

	/**
	 * Info to show for all users
	 */
	anonInfo: {
		nick: 'anon',
		username: 'anon',
		realname: 'Anonymous',
		hostname: 'anonymous.anon',
		status: 'H' // Online, no special permissions
	},

	motd: `
Welcome to the AnonIRCd!
Here, all of your messages appear under the nick "anon", and nobody knows who says what.
Enjoy!
-
`
}

// Record the start time
const startTime = new Date()

// Create IRCd
const { Ircd } = require('../index')
const ircd = new Ircd(config.hostname)

// Create connection logic
ircd.onConnect(async function(client) {
	console.log('Client connected')

	client.onLoginAttempt(async function(userInfo, password, accept, deny) {
		// Check if the nick is already taken
		if(ircd.isNickConnected(userInfo.nick)) {
			console.log(`Client tried to take the name ${userInfo.nick} but it was already taken`)
			await client.sendNickRejected(userInfo.nick)
			await deny()
			return
		}

		// If all went well, accept the auth attempt
		await accept()
	})
	client.onSuccessfulLogin(async function() {
		console.log(`User ${client.nick} authenticated`)

		// Do initial client setup
		await client.sendServerInfo(
			'Welcome to the AnonIRCd server',
			`Your host is ${config.hostname} running AnonIRCd`,
			`The server was created on ${startTime.toISOString()}`,
			'AnonIRCd',
			config.networkName
		)
		await client.sendMotd(config.motd)
		await client.setMode('+Zi')
		await client.setHostname(config.anonInfo.hostname)

		// Join main channel
		await client.sendSelfJoin(config.channel)

		// Send join to other clients
		for(const authClient of ircd.authenticatedClients) {
			if(authClient.nick !== client.nick)
				authClient.sendUserJoin(config.channel, client.userInfo).finally()
		}
	})
	client.onDisconnect(function() {
		if(client.isAuthenticated) {
			console.log(`User ${client.nick} disconnected`)

			// Send part to other clients
			for(const authClient of ircd.authenticatedClients) {
				if(authClient.nick !== client.nick)
					authClient.sendUserPart(config.channel, client.userInfo, 'Disconnected')
			}
		} else {
			console.log('Unauthenticated client disconnected')
		}
	})

	client.onChannelInfo(async function(channel) {
		if(channel === config.channel)
			await client.sendChannelInfo(channel, config.channelTopic, config.anonInfo, '+Cnt', startTime, ircd.authenticatedClients.map(c => c.userInfo))
	})
	client.onChannelUsers(async function(channel) {
		await client.sendChannelUsers(channel, ircd.authenticatedClients.map(c => c.userInfo))
	})

	client.onChatMessage(function(channel, message) {
		// Ignore messages not sent in the main channel
		if(channel !== config.channel)
			return

		// Log real user and message
		console.log(`<${client.nick}> ${message}`)

		// Send anonymous message to channel users
		for(const authClient of ircd.authenticatedClients) {
			if(authClient.nick !== client.nick)
				authClient.sendChatMessage(channel, config.anonInfo, message)
		}
	})

	// If the client tries to join the channel (like if the force join didn't work), just send a normal join
	client.onJoin(function(channel) {
		if(channel === config.channel)
			client.sendSelfJoin(channel)
	})
})

// Start server
ircd.listen(config.port, config.host).then(function() {
	console.log(`Listening at ${config.host}:${config.port}`)
})