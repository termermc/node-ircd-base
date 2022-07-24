# node-ircd-base
A Node.js library for implementing IRC servers using a simple API

# Install
To install it in your project, run `npm install ircd-base` or `yarn add ircd-base`.

# What is it?
This library is a set of building blocks to create your own IRC server (IRCd).
This can be used for a variety of purposes, including creating IRC gateways to other protocols, creating custom chat servers, and integrating IRC into existing Node.js projects.

To show the capabilities of the library check out the following example:

```javascript
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
```

An IRC server running on port 6667 that allows users to login only using the password "test", after which a MotD is sent.
All that was required was 38 lines of clean code.

Because all the library provides is an interface for receiving events and interacting with clients, all logic is left to the programmer.
This provides the programmer with freedom to script their IRC server however they want without having to worry about IRC protocol specifics.