import { Ircd } from '../dist/index.js'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:tls'

const ircd = new Ircd('test.example.net')

ircd.onConnect(function (client) {
	client.onLoginAttempt(async function (userInfo, password, accept, deny) {
		console.log('hi')
		await accept()
	})
	client.onSuccessfulLogin(async function () {
		await client.sendServerInfo(
			'Welcome',
			'You are connected to ' + ircd.hostname,
			'The server was created at some point in time',
			'TestServer-1.0.0',
			'TestNet',
		)
		await client.sendMotd(':)')
		await client.setMode('+Zi')
	})
})

ircd.listen(6667).then(function () {
	console.log(`Listening on port 6667`)
})
const server = createServer(
	{
		key: readFileSync('./privkey.pem'),
		cert: readFileSync('./fullchain.pem'),
	},
	ircd.socketHandler.bind(ircd),
)

server.listen(6697, '127.0.0.1', function () {
	console.log('Listening on port 6697 (TLS)')
})
