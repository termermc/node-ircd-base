const Ircd = require('./src/ircd')

// Start a basic development server that displays the capabilities of the library
const ircd = new Ircd()

ircd.hostname = 'my.network'

ircd.onConnect(async function(client) {
    console.log('Client connected')

    await client.sendNotice('You are about to login');

    client.onLoginAttempt(async function(userInfo, password, accept, deny) {
        if(password === 'test')
            await accept()
        else
            await deny()
    })
    client.onSuccessfulLogin(async function() {
        console.log(`User ${client.nick} authenticated`)
        await client.sendMotd('Hello world!\nThis is my test MotD!\nWelcome to my IRCd!')
        await client.setMode('+Zi')
    })
    client.onFailedLogin(async function(userInfo, password) {
        console.log(`User ${userInfo.nick} tried to login with password "${password}", but it wasn't correct`)
        await client.disconnect('Wrong username or password')
    })
    client.onDisconnect(function() {
        if(client.isAuthenticated)
            console.log(`User ${client.nick} disconnected`)
        else
            console.log('Unauthenticated client disconnected')
    })
})

ircd.listen(6667, 'localhost').then(function() {
    console.log(`Listening at ${ircd.host}:${ircd.port}`)
})