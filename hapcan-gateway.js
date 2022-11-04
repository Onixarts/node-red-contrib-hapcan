module.exports = function (RED) {
   "use strict";
    var reconnectTime = RED.settings.socketReconnectTime || 10000;
    var socketTimeout = RED.settings.socketTimeout || null;
    var net = require('net');
    var events = require('events');

    var ConnectionStatus = Object.freeze(
        {
            notConnected: { value: 0, name: "not connected"}, 
            connecting: {value: 1, name: "connecting"},
            connected: {value: 2, name: "connected"},
            closing: {value: 5, name: "closing"}
    });


    function HapcanGatewayNode(config) {
        RED.nodes.createNode(this, config);
        this.host = config.host;
        this.port = config.port;
        this.group = config.group;
        this.node = config.node;
        this.reconnectPeriod = Number(config.reconnectPeriod || 1000);
        this.client = null;
        this.debugmode = config.debugmode || false;
        this.incommingMessage = Buffer.alloc(15,0xFF);
        this.incommingMessageIndex = 0;
        this.eventEmitter = new events.EventEmitter();
        this.eventEmitter.setMaxListeners(50);
        this.devices = config.devices;
        if(this.devices === undefined)
            this.devices = []


        this.connectionStatus = ConnectionStatus.notConnected;
        
        var node = this;

        node.setConnectionStatus = function(connectionStatus)
        {
            node.log(connectionStatus.name);
            node.connectionStatus = connectionStatus;

            var status =  {};
            switch(node.connectionStatus.value)
            {
                case ConnectionStatus.notConnected.value:
                    status = {fill:"red",shape:"dot",text:"Not connected"};
                    break;
                case ConnectionStatus.connecting.value:
                    status = {fill:"yellow",shape:"dot",text:"Connecting"};
                    break;
                case ConnectionStatus.connected.value:
                    status = {fill:"green",shape:"dot",text:"Connected"};
                    break;
            }
            node.status(status);
            node.eventEmitter.emit('statusChanged', status);
        };

        this.connect = function (){

            if(node.connectionStatus.value === ConnectionStatus.notConnected.value)
            {
                node.setConnectionStatus(ConnectionStatus.connecting);
                
                node.client = net.createConnection(node.port, node.host);

                node.client.on('error', function(err){
                    node.log('error during connection occured: ' + err);
                });

                node.client.on('close', function(){
                    node.setConnectionStatus(ConnectionStatus.notConnected);
                    node.reconnect();
                });

                node.client.on('connect', function(socket){
                    node.setConnectionStatus(ConnectionStatus.connected);
                });
                
                node.client.on('data', function(data){

                    for(var i = 0; i < data.length; i++)
                    {
                        if(node.incommingMessageIndex === 0 && data[i] !== 0xAA)
                            continue

                        node.incommingMessage[node.incommingMessageIndex] = data[i];
                        
                        if(node.incommingMessageIndex === 12  && data[i] === 0xA5 ){
                            node.messageReceived(node.incommingMessage);
                            node.incommingMessage.fill(0xFF);
                            node.incommingMessageIndex = 0;
                            continue
                        }

                        if(node.incommingMessageIndex === 14 ){
                            if(data[i] === 0xA5) {
                                node.messageReceived(node.incommingMessage);
                                node.incommingMessage.fill(0xFF);
                                node.incommingMessageIndex = 0;
                                continue
                            }
                            else {
                                node.warn('Invalid frame received:' + node.messageToString(node.incommingMessage));
                                node.incommingMessage.fill(0xFF);
                                node.incommingMessageIndex = 0;
                                continue
                            }
                        }
                        node.incommingMessageIndex++;
                    }
                });
            }

        };

        this.reconnect = function() {
            setTimeout(()=>{
                this.client.removeAllListeners();
                this.connect();
            }, node.reconnectPeriod);
        }

        this.messageToString = function(hapcanMessage)
        {
            var messageString = '';
            for(var i = 0; i < hapcanMessage.length; i++)
                messageString+= ' ' + ("0" + hapcanMessage[i].toString(16).toUpperCase()).slice (-2);
            return messageString;
        }

        this.on('close', function() {
            node.setConnectionStatus(ConnectionStatus.notConnected);
        });

        class HapcanMessage {
            constructor(frame) {
                this.frame = Buffer.from(frame);
                this.frameType = (frame[1] << 4) + (frame[2] >>> 4)
                this.isAnswer = (frame[2] & 0x01) === 0 ? false : true;
                this.node = frame[3];
                this.group = frame[4];
            }
        }

        this.getDeviceInfo = function(nodeNumber, groupNumber, channelNumber)
        {
            var deviceId = ('00'+ nodeNumber.toString(16)).substr(-2).toUpperCase() + ('00'+ groupNumber.toString(16)).substr(-2).toUpperCase()
            var device = node.devices.find( v => v.id === deviceId )
            let deviceInfo = {
                deviceName: `device_${deviceId}`,
                channelName: `channel_${channelNumber}`
            }

            if(device !== undefined)
            {

                if(device.description !== '')
                    deviceInfo.deviceName = device.description

                if(channelNumber<1)
                {
                    node.error(`Channel number must be 1 or more`)
                    return null
                }
                
                if(device.channels.length > 0 && channelNumber > device.channels.length)
                {
                    node.error(`Channel number must be less than device available channels count (${device.channels.count})`)
                    return null
                }
                
                let channelName = device.channels[channelNumber-1].customName
                if(channelName === undefined || channelName === '')
                    channelName = device.channels[channelNumber-1].name
                if(channelName !== '')
                    deviceInfo.channelName = channelName
            }
            return deviceInfo
        }
        
        this.messageReceived = function(frame)
        {
            if(node.debugmode)
                node.log('received: << ' + node.messageToString(frame));

            var hapcanMsg = new HapcanMessage(frame);

            var eventArgs = { payload: hapcanMsg, topic: 'Hapcan Message' };
            node.eventEmitter.emit('messageReceived', eventArgs);
            node.eventEmitter.emit('messageReceived_'+ ('000' + hapcanMsg.frameType.toString(16)).substr(-3).toUpperCase(), RED.util.cloneMessage(eventArgs));
        }

        this.send = function(msg){
            if (node.connectionStatus.value === ConnectionStatus.connected.value ) {
                if (msg.payload === null || msg.payload === undefined) {
                    msg.payload = "";
                } 
                else if (Buffer.isBuffer(msg.payload)) {

                    var sum = 0;
                    if( msg.payload.length === 15)
                    {
                        for (var i = 1; i < 13; i++)
                        {
                            sum += msg.payload[i];
                        }
                        msg.payload[13] = sum;
                    }
                    else if(msg.payload.length === 13)
                    {
                        for (var i = 1; i < 11; i++)
                        {
                            sum += msg.payload[i];
                        }
                        msg.payload[11] = sum;  
                    }
                    
                    if( node.debugmode )
                        this.log('sending:  >> '+ node.messageToString(msg.payload));

                    node.client.write(msg.payload);
                }
            }
        };

        node.setConnectionStatus(ConnectionStatus.notConnected);
        node.connect();

        this.requestIdGroup = 0
        this.foundDevicesInGroup = 0
        this.firmwareResponseInGroup = 0
        this.channelDescription = ''
        this.channelDescriptionFramesReceived = 0
        

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async function waitForChannelDescriptionResponseAsync(){
            for (let i = 0; i < 20; i++) {
                await sleep(100);
                if(node.channelDescriptionFramesReceived === 5)
                    return
            }
            throw new Error(`Timeout while requesting node channel description`)
        }

        async function waitForNewDevicesAsync(){
            let previousFoundDevicesCount = node.foundDevicesInGroup
            try{
                
                for (let i = 0; i < 30; i++) {
                    await sleep(100);
                    let currentDevicesFound = node.foundDevicesInGroup
                    if(currentDevicesFound === previousFoundDevicesCount)
                        break
                    previousFoundDevicesCount = currentDevicesFound
                }
            }
            catch(e)
            {
                console.log(e)
            }
        }

        async function waitForFirmwareResponseAsync(){
            let previousFirmwareResponsesInGroup = node.firmwareResponsesInGroup
            try{
                
                for (let i = 0; i < 30; i++) {
                    await sleep(100);
                    let currentResponsesCount = node.firmwareResponsesInGroup
                    if(currentResponsesCount === previousFirmwareResponsesInGroup || currentResponsesCount === node.foundDevicesInGroup )
                        break
                    previousFirmwareResponsesInGroup = currentResponsesCount
                }
            }
            catch(e)
            {
                console.log(e)
            }
        }

        async function waitForDescriptionResponseAsync(){
            let previousDescriptionResponsesInGroup = node.descriptionResponsesInGroup
            try{
                
                for (let i = 0; i < 30; i++) {
                    await sleep(200);
                    let currentResponsesCount = node.descriptionResponsesInGroup
                    if(currentResponsesCount === previousDescriptionResponsesInGroup || currentResponsesCount === node.foundDevicesInGroup )
                        break
                    previousDescriptionResponsesInGroup = currentResponsesCount
                }
            }
            catch(e)
            {
                console.log(e)
            }
        }

        RED.httpAdmin.get("/hapcan-device-channel-description/:id/:node/:group/:channel", RED.auth.needsPermission('serial.read'), async function(req,res) {
            
            var node = RED.nodes.getNode(req.params.id);
 
            try{
                node.requestIdGroup = Number(req.params.group)
                var nodeNumber = Number(req.params.node)
                var channel = Number(req.params.channel)

                node.channelDescription = ''
                node.channelDescriptionFramesReceived = 0

                // request channel description from node
                var msg = Buffer.from([0xAA, 0x11, 0x70, node.node,node.group, channel, 0xFF, nodeNumber, req.params.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                node.send({payload: msg})
                
                await waitForChannelDescriptionResponseAsync()
            }
            catch(e)
            {
                console.log(e)
                res.json('{}')
                return
            }
    
            res.json(JSON.stringify({name: node.channelDescription})); 
        })

        RED.httpAdmin.get("/hapcan-devices-discover/:id/:group", RED.auth.needsPermission('serial.read'), async function(req,res) {
            
            var node = RED.nodes.getNode(req.params.id);
                node.devices = []
    
            node.foundDevicesInGroup = 0
            node.firmwareResponsesInGroup = 0
            node.descriptionResponsesInGroup = 0
    
            try{
                node.requestIdGroup = Number(req.params.group)
    
                // request Id from group
                var msg = Buffer.from([0xAA, 0x10, 0x30, node.node,node.group, 0xFF,0xFF,0x00, req.params.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                node.send({payload: msg})
                
                await waitForNewDevicesAsync()
    
                if(node.foundDevicesInGroup > 0 )
                {
                    // request firmware type from group
                    var msg = Buffer.from([0xAA, 0x10, 0x50, node.node,node.group, 0xFF,0xFF,0x00, req.params.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                    node.send({payload: msg})
    
                    await waitForFirmwareResponseAsync()
    
                    // request description from group
                    var msg = Buffer.from([0xAA, 0x10, 0xD0, node.node,node.group, 0xFF,0xFF,0x00, req.params.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                    node.send({payload: msg})
    
                    await waitForDescriptionResponseAsync()
                }
            }
            catch(e)
            {console.log(e)}
    
            res.json(JSON.stringify(node.devices));
            
        });

        class HapcanDevice {
            constructor(id) {
                this.id = id
                this.node = 0;
                this.group = 0;
                this.description = ''
                this.descriptionFirstPart = true
                this.serialNumber = 0;
                this.hardwareType = 0
                this.hardwareTypeString = 'unknown'
                this.hardwareVersion = 0
                this.applicationType = 0
                this.applicationTypeString = 'unknown'
                this.applicationTypeIcon = 'fa-microchip'
                this.applicationVersion = 0
                this.firmwareVersion = 0
                this.channels = []
            }

            initChannels(type, icon, count)
            {
                this.channels = []
                this.addChannels(type, icon, count)
            }
            addChannels(type, icon, count)
            {
                for(let i = 0; i < count; i++)
                    this.channels.push(new HapcanDeviceChannel(type, icon, `${type}_${i+1}`))
            }
        }

        class HapcanDeviceChannel {
            constructor(type, icon, name)
            {
                this.icon = icon
                this.type = type
                this.name = name
                this.customName = ''
            }
        }

        //hardware type response
        node.eventEmitter.on('messageReceived_103', function(data){
            
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
            var device = node.devices.find( v => v.id === deviceId )
            if( device === undefined )
            {
                device = new HapcanDevice(deviceId)
                node.devices.push(device)
                node.foundDevicesInGroup += 1
            }
                
            device.node = hapcanMessage.node
            device.group = hapcanMessage.group
            device.serialNumber = '0x' + ('00000000' + ((hapcanMessage.frame[9]<<24)+(hapcanMessage.frame[10]<<16)+(hapcanMessage.frame[11]<<8)+hapcanMessage.frame[12]).toString(16)).substr(-8).toUpperCase()
            device.hardwareType = (hapcanMessage.frame[5]<<8)+hapcanMessage.frame[6]
            switch(device.hardwareType)
            {
                case 0x1000: device.hardwareTypeString = 'UNIV 1'; break
                case 0x3000: device.hardwareTypeString = 'UNIV 3'; break
                case 0x4F41: device.hardwareTypeString = 'Hapcanuino'; break
                default:
                    device.hardwareTypeString = 'unknown'
            }

        })

        //firmware response
        node.messageReceived_105 = function(data)
        {
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
            var device = node.devices.find( v => v.id === deviceId )
            if( device === undefined )
                return;

            node.firmwareResponsesInGroup += 1
            device.hardwareVersion = hapcanMessage.frame[7]
            device.applicationType = hapcanMessage.frame[8]
            device.applicationVersion = hapcanMessage.frame[9]
            device.firmwareVersion = hapcanMessage.frame[10]

            switch(device.applicationType)
            {
                case 0x01: device.applicationTypeString = 'Button'; device.applicationTypeIcon = 'fa-hand-o-down';
                        switch(Number(device.hardwareVersion))
                        {
                            case 1:
                                //TODO: UNIV1 devices has a different version meaning?
                                break
                            case 3:
                                switch(Number(device.applicationVersion))
                                {
                                    case 0: device.initChannels('button', 'fa-hand-o-down', 8); break;
                                    case 1: device.initChannels('button', 'fa-hand-o-down', 13); device.addChannels('temperature', 'fa-thermometer-half', 1); break;
                                    case 2: device.initChannels('button', 'fa-hand-o-down', 6); device.addChannels('temperature', 'fa-thermometer-half', 1); break;
                                    case 3: device.initChannels('button', 'fa-hand-o-down', 14); device.addChannels('temperature', 'fa-thermometer-half', 1); break;
                                }
                                break
                        }
                break
                case 0x02: device.applicationTypeString = 'Relay'; device.applicationTypeIcon = 'fa-power-off'; device.initChannels('relay', 'fa-power-off', 6); break
                //case 0x03: device.applicationTypeString = 'IR Receiver'; device.applicationTypeIcon = 'fa-feed'; break
                //case 0x04: device.applicationTypeString = 'Temp. sensor'; device.applicationTypeIcon = 'fa-thermometer-half'; break
                case 0x05: device.applicationTypeString = 'IR transmitter'; device.applicationTypeIcon = 'fa-feed'; device.initChannels('ir', 'fa-feed', 1); break
                case 0x06: device.applicationTypeString = 'Dimmer'; device.applicationTypeIcon = 'fa-lightbulb-o'; device.initChannels('dimmer', 'fa-lightbulb-o', 1); break
                case 0x07: device.applicationTypeString = 'Blind controller'; device.applicationTypeIcon = 'fa-bars'; device.initChannels('blind', 'fa-bars', 3); break
                case 0x08: device.applicationTypeString = 'Led controller'; device.applicationTypeIcon = 'fa-stop-circle-o'; device.initChannels('rgb', 'fa-play-circle-o', 3); device.addChannels('master', 'fa-stop-circle-o', 1); break
                case 0x09: device.applicationTypeString = 'Open collector'; device.applicationTypeIcon = 'fa-external-link'; device.initChannels('oc', 'fa-external-link', 10); break
                
                default:
                    device.hardwareTypeString = 'Custom device'
                    device.applicationTypeIcon = 'fa-microchip'

            }
        }
        
        //description response
        node.messageReceived_10D = function(data)
        {
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
            var device = node.devices.find( v => v.id === deviceId )
            if( device === undefined )
                return;

            if(device.descriptionFirstPart)
                device.description = ''
            else
            {
                node.descriptionResponsesInGroup += 1
            }
            device.description += hapcanMessage.frame.slice(5,13).toString().replace(/\x00/g,'')
            device.descriptionFirstPart = !device.descriptionFirstPart
        }

        //channel description response
        node.messageReceived_117 = function(data)
        {
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            //var responseChannel = hapcanMessage.frame[5] >>> 3
            //var frameNumber = hapcanMessage.frame[5] & 0x07

            node.channelDescription += hapcanMessage.frame.slice(6,13).filter((e)=> e >= 32 && e < 127).toString()
            node.channelDescriptionFramesReceived++;
        }        

        node.eventEmitter.on('messageReceived_105', node.messageReceived_105)
        node.eventEmitter.on('messageReceived_10D', node.messageReceived_10D)
        node.eventEmitter.on('messageReceived_117', node.messageReceived_117)

        this.on('close', function() {
            node.eventEmitter.removeListener('messageReceived_105', node.messageReceived_105)
            node.eventEmitter.removeListener('messageReceived_10D', node.messageReceived_10D)
            node.eventEmitter.removeListener('messageReceived_117', node.messageReceived_117)
        });
    }
    RED.nodes.registerType("hapcan-gateway", HapcanGatewayNode);


}