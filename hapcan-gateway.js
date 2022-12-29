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

        this.getDeviceInfo = function(nodeNumber, groupNumber, channelType, channelNumber)
        {
            var deviceId = ('00'+ nodeNumber.toString(16)).substr(-2).toUpperCase() + ('00'+ groupNumber.toString(16)).substr(-2).toUpperCase()
            var device = node.devices.find( v => v.id === deviceId )
            let deviceInfo = {
                deviceName: `device_${deviceId}`,
                channelName: `${channelType === null ? 'unknown_channel' : channelType}_${channelNumber}`
            }

            if(device !== undefined)
            {

                if(device.description !== '')
                    deviceInfo.deviceName = device.description
                    
                if(channelType !== null)
                {
                    if(channelNumber<1)
                    {
                        node.error(`Channel number must be 1 or more`)
                        return null
                    }
                
                    let typedChannels = device.channels.filter((channel)=> channel.type === channelType)
                    if( typedChannels.length === 0 )
                    {
                        node.error(`Channel type (${channelType}) not found in device ${deviceId}`)
                        return null
                    }

                    if(typedChannels.length > 0 && channelNumber > typedChannels.length)
                    {
                        node.error(`Channel number of type (${channelType}) must be less than device available channels count (${typedChannels.length})`)
                        return null
                    }
                    
                    let channelName = typedChannels[channelNumber-1].customName
                    if(channelName === undefined || channelName === '')
                        channelName = typedChannels[channelNumber-1].name
                    if(channelName !== '')
                        deviceInfo.channelName = channelName
                }
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

        this.channelDescription = ''

        function sleep(ms) {
            return new Promise(timerResolve => setTimeout(timerResolve, ms));
        }

        async function receiveIdResponseFromGroupAsync(group){
            let devicesFound = []

            const messageReceived_103 = function(data){
            
                var hapcanMessage = data.payload
                if(group !== Number(hapcanMessage.group))
                    return;
    
                var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
                var device = devicesFound.find( v => v.id === deviceId )
                if( device === undefined )
                {
                    device = new HapcanDevice(deviceId)
                    devicesFound.push(device)
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
            }

            node.eventEmitter.on('messageReceived_103', messageReceived_103)

            try {
                let previousLoopDevicesResponseCount = 0
                let retryCount = 4
                do {
                    await sleep(25);

                    if(previousLoopDevicesResponseCount === devicesFound.length)
                        retryCount--
                    else
                        retryCount = 3

                    previousLoopDevicesResponseCount = devicesFound.length
                } while (retryCount > 0)

            }
            catch(e)
            {
                console.log(e)
            }
            finally
            {
                node.eventEmitter.off('messageReceived_103', messageReceived_103)
            }

            return devicesFound
        }

        function fetchFirmwareFromDeviceAsync(gatewayNode, device, timeout)
        {
            // request firmware type from node
            var msg = Buffer.from([0xAA, 0x10, 0x60, gatewayNode.node, gatewayNode.group, 0xFF,0xFF, device.node, device.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            gatewayNode.send({payload: msg})
            
            return new Promise((resolve, reject)=>
            {
                let timeoutTimer = setTimeout(()=>
                {
                    gatewayNode.eventEmitter.off('messageReceived_106', messageReceived_106 )
                    reject(`Timeout occured (${timeout} ms)`)
                }
                , timeout)

                function messageReceived_106(data)
                {
                    var hapcanMessage = data.payload
                    if(device.group !== Number(hapcanMessage.group) || device.node !== Number(hapcanMessage.node))
                        return;
                                        
                    //console.log(`device firmware responsefor node: ${hapcanMessage.node}`)

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
                                            case 1: device.initChannels('button', 'fa-hand-o-down', 13); 
                                                    device.addChannels('temperature', 'fa-thermometer-half', 1); 
                                                    break;
                                            case 2: device.initChannels('button', 'fa-hand-o-down', 6); 
                                                    device.addChannels('temperature', 'fa-thermometer-half', 1); 
                                                    device.addChannels('thermostat', 'fa-fire', 1); 
                                                    break;
                                            case 3: device.initChannels('button', 'fa-hand-o-down', 14); 
                                                    device.addChannels('temperature', 'fa-thermometer-half', 1); 
                                                    device.addChannels('thermostat', 'fa-fire', 1); 
                                                    break;
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
                        case 0x08: device.applicationTypeString = 'Led controller'; device.applicationTypeIcon = 'fa-stop-circle-o'; device.initChannels('rgb', 'fa-play-circle-o', 4); break
                        case 0x09: device.applicationTypeString = 'Open collector'; device.applicationTypeIcon = 'fa-external-link'; device.initChannels('oc', 'fa-external-link', 10); break
                        
                        default:
                            device.hardwareTypeString = 'Custom device'
                            device.applicationTypeIcon = 'fa-microchip'

                    }
                    
                    clearTimeout(timeoutTimer)
                    gatewayNode.eventEmitter.off('messageReceived_106', messageReceived_106 )
                    resolve(device)
                }

                gatewayNode.eventEmitter.on('messageReceived_106', messageReceived_106 )
            })
        }

        function fetchDescriptionFromDeviceAsync(gatewayNode, device, timeout)
        {

            // request description from node
            var msg = Buffer.from([0xAA, 0x10, 0xE0, gatewayNode.node,gatewayNode.group, 0xFF,0xFF, device.node, device.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            gatewayNode.send({payload: msg})
    
            return new Promise((resolve, reject)=>
            {
                let timeoutTimer = setTimeout(()=>
                {
                    gatewayNode.eventEmitter.off('messageReceived_10E', messageReceived_10E )
                    reject(`Timeout occured (${timeout} ms)`)
                }
                , timeout)

                let chunks = []

                function messageReceived_10E(data)
                {
                    var hapcanMessage = data.payload
                    if(device.group !== Number(hapcanMessage.group) || device.node !== Number(hapcanMessage.node))
                        return;

                    chunks.push(hapcanMessage.frame.slice(5,13).toString().replace(/\x00/g,''))

                    if(chunks.length < 2)
                        return

                    device.description = chunks.join('')

                    clearTimeout(timeoutTimer)
                    gatewayNode.eventEmitter.off('messageReceived_10E', messageReceived_10E )
                    resolve(device)
                }

                gatewayNode.eventEmitter.on('messageReceived_10E', messageReceived_10E )
            })
        }        

        async function fetchAllChannelDescriptionFromDeviceAsync(gatewayNode, device, timeout)
        {
            let channelType = ''
            for(var j = 1;j < device.channels.length+1; j++)
            {
                if( j === 1 )
                    channelType = device.channels[j-1].type
                
                // don't ask for other channels (only main device channels have a name)
                if(channelType !== device.channels[j-1].type)
                    break;

                let description = await fetchChannelDescriptionFromDeviceAsync(gatewayNode, device, j, timeout)

                if(description !== undefined )
                {
                    if(description !== '')
                        device.channels[j-1].name = description
                }
            }
        }

        function fetchChannelDescriptionFromDeviceAsync(gatewayNode, device, channel, timeout)
        {
            // request channel description from node
            let msg = Buffer.from([0xAA, 0x11, 0x70, gatewayNode.node,gatewayNode.group, channel, 0xFF, device.node, device.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            gatewayNode.send({payload: msg})
    
            return new Promise((resolve, reject)=>
            {
                let chunks = []
                let timeoutTimer = setTimeout(()=>
                {
                    gatewayNode.eventEmitter.off('messageReceived_117', messageReceived_117 )
                    reject(`Timeout occured (${timeout} ms). ${chunks.length} of 5 frames received`)
                }
                , timeout)

                let ret = ''
                function messageReceived_117(data)
                {
                    var hapcanMessage = data.payload
                    if(device.group !== Number(hapcanMessage.group) || device.node !== Number(hapcanMessage.node))
                        return;

                    chunks.push(hapcanMessage.frame.slice(6,13).filter((e)=> e >= 32 && e < 127).toString())

                    if(chunks.length < 5)
                        return

                    ret = chunks.join('')

                    clearTimeout(timeoutTimer)
                    gatewayNode.eventEmitter.off('messageReceived_117', messageReceived_117 )
                    resolve(ret)
                }

                gatewayNode.eventEmitter.on('messageReceived_117', messageReceived_117 )
            })
        }        

        RED.httpAdmin.get("/hapcan-devices-discover/:id/:group", RED.auth.needsPermission('serial.read'), async function(req,res) {
            
            var gatewayNode = RED.nodes.getNode(req.params.id);
            let group = Number(req.params.group)
            let devicesFound = []
            
            try{
                // request Id from group
                var msg = Buffer.from([0xAA, 0x10, 0x30, gatewayNode.node, gatewayNode.group, 0xFF,0xFF,0x00, group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                gatewayNode.send({payload: msg})
                
                devicesFound = await receiveIdResponseFromGroupAsync(Number(req.params.group))

                for(let i = 0;i < devicesFound.length; i++)
                {
                    let device = devicesFound[i]
                    try
                    {
                        await fetchFirmwareFromDeviceAsync(gatewayNode, device, 3000)
                    }
                    catch(e)
                    {
                        if(gatewayNode.debugmode)
                            gatewayNode.error(`Device (${device.node}, ${device.group}) not respond to firmware request: ${e}`);
                    }
    
                    try
                    {
                        await fetchDescriptionFromDeviceAsync(gatewayNode, device, 3000)
                    }
                    catch(e)
                    {
                        if(gatewayNode.debugmode)
                            gatewayNode.error(`Device (${device.node}, ${device.group}) not respond to description request: ${e}`);
                    }

                    try
                    {
                        if( device.supportsFrame0x117() )
                        {
                            await fetchAllChannelDescriptionFromDeviceAsync(gatewayNode, device, 3000)
                        }
                    }
                    catch(e)
                    {
                        if(gatewayNode.debugmode)
                            gatewayNode.error(`Fetching device (${device.node},${device.group}) channels description failed: ${e}`)
                    }

                }
            }
            catch(e)
            {
                if(gatewayNode.debugmode)
                    gatewayNode.error(`Discovering devices in group ${group} failed: ${e}`)
            }

            res.json(JSON.stringify(devicesFound));
            
        });

        class HapcanDevice {
            constructor(id) {
                this.id = id
                this.node = 0;
                this.group = 0;
                this.description = ''
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

            
            // [hardwareVersion, applicationType, applicationVersion, firmwareVersion]
            static frame0x117Support = [
                [3,1,0,0],  // 8 CHANNEL DIN RAIL BOX BUTTON 
                [3,1,2,1],  // 6 CHANNEL BACK BOX TOUCH BUTTON
                [3,1,3,1],  // 14 CHANNEL BACK BOX BUTTON
                [3,2,1,0],  // 5A MONOSTABLE RELAY
                [3,2,2,0],  // 5A BISTABLE RELAY
                [3,2,3,0],  // 16A MONOSTABLE RELAY
                [3,2,4,3],  // 16A BISTABLE RELAY
                [3,2,5,0],  // 6A MONOSTABLE RELAY
                [3,5,0,3],  // INFRARED RECEIVER & TRANSMITTER
                [3,6,0,2],  // DIMMER RC
                [3,7,0,0],  // BLIND CONTROLLER for AC MOTORS
                [3,8,0,0],  // RGB LED CONTROLLER
                [3,9,0,0],  // 10 CHANNEL OPEN COLLECTOR 
            ]

            supportsFrame0x117()
            {
                return HapcanDevice.frame0x117Support.some((minimalDevice)=>{
                    if( this.hardwareVersion !== minimalDevice[0] )
                        return false
                    if(this.applicationType !== minimalDevice[1])
                        return false
                    if(this.applicationVersion !== minimalDevice[2])
                        return false
                    if(this.firmwareVersion < minimalDevice[3])
                        return false

                    return true
                })
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


        this.on('close', function() {

        });
    }
    RED.nodes.registerType("hapcan-gateway", HapcanGatewayNode);


}