const Ircd = require('./src/ircd')
const {getCurrentMs} = require("./src/util/misc");

// Start a basic development server that displays the capabilities of the library
const ircd = new Ircd()

ircd.hostname = 'my.network'

ircd.onConnect(async function(client) {
    console.log('Client connected')

    await client.sendNotice('You are about to login', 'Server');

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

    // TODO Remove this
    /**
     * @type {{[key: string]: IrcUserInfo[]}}
     */
    const channelUsers = {
        '#test': [
            {
                nick: 'Funnyman69',
                username: 'Funnyman69m',
                realname: 'Funman',
                hostname: 'sixetynine.fun',
                status: 'H@'
            },
            {
                nick: 'jim22',
                username: 'jimbob2022',
                realname: 'JimmyRobert',
                hostname: 'minecraft.net',
                status: 'H+'
            },
            {
                nick: 'idiot',
                username: 'idiot',
                realname: 'idiot',
                hostname: ircd.hostname,
                status: 'G+'
            }
        ]
    }

    client.onJoin(async function(channel) {
        if(!(channel in channelUsers))
            channelUsers[channel] = []
        channelUsers[channel].push(client.userInfo)

        await client.sendSelfJoin(channel)
    })
    client.onChannelInfo(async function(channel) {
        await client.sendChannelInfo(channel, 'stupid channel', channelUsers[channel][0], '+Cnt', new Date(), channelUsers[channel])
    })
    client.onChannelUsers(async function(channel) {
        await client.sendChannelUsers(channel, channelUsers[channel])
    })

    client.onAway(async function(message) {
        await client.sendSelfAway(message)
    })
    client.onBack(async function() {
        await client.sendSelfBack()
    })
})

ircd.listen(6667, 'localhost').then(function() {
    console.log(`Listening at ${ircd.host}:${ircd.port}`)
})