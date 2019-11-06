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
        this.incommingMessage = Buffer.allocUnsafe(15);
        this.incommingMessage.fill(0xFF);
        this.incommingMessageIndex = 0;
        this.eventEmitter = new events.EventEmitter();
        this.eventEmitter.setMaxListeners(50);

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
                        node.incommingMessage[node.incommingMessageIndex] = data[i];
                        node.incommingMessageIndex++;
                        if(node.incommingMessageIndex === 15)
                        {
                            if(node.incommingMessage[0] === 0xAA && node.incommingMessage[14]=== 0xA5)
                                node.messageReceived(node.incommingMessage);
                            else
                                node.warn('Invalid frame received:' + node.messageToString(node.incommingMessage));
                            node.incommingMessage.fill(0xFF);
                            node.incommingMessageIndex = 0;
                        }
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
                this.frame = frame;
                this.frameType = (frame[1] << 4) + (frame[2] >>> 4)
                this.isAnswer = (frame[2] & 0x01) === 0 ? false : true;
                this.node = frame[3];
                this.group = frame[4];
            }
        }

        
        this.messageReceived = function(frame)
        {
            if(node.debugmode)
                node.log('received: << ' + node.messageToString(frame));

            var hapcanMsg = new HapcanMessage(frame);

            var eventArgs = { payload: hapcanMsg, topic: 'Hapcan Message' };
            node.eventEmitter.emit('messageReceived', eventArgs);
            node.eventEmitter.emit('messageReceived_'+ ('000' + hapcanMsg.frameType.toString(16)).substr(-3).toUpperCase(), eventArgs);
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

        this.devices = {}
        this.requestIdGroup = 0
        this.foundDevicesInGroup = 0
        this.firmwareResponseInGroup = 0

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async function waitForNewDevicesAsync(){
            let previousFoundDevicesCount = node.foundDevicesInGroup
            try{
                
                for (let i = 0; i < 10; i++) {
                    await sleep(100);
                    let currentDevicesFound = node.foundDevicesInGroup
                    if(currentDevicesFound === previousFoundDevicesCount)
                    {
                        break
                    }
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
                
                for (let i = 0; i < 10; i++) {
                    await sleep(100);
                    let currentResponsesCount = node.firmwareResponsesInGroup
                    if(currentResponsesCount === previousFirmwareResponsesInGroup || currentResponsesCount === node.foundDevicesInGroup )
                    {
                        break
                    }
                    previousFirmwareResponsesInGroup = currentResponsesCount
                }
            }
            catch(e)
            {
                console.log(e)
            }
        }

        RED.httpAdmin.get("/hapcan-devices-discover", RED.auth.needsPermission('serial.read'), async function(req,res) {
            
            if(Number(req.query.group) === 1)
            {
                node.devices = {}
            }

            node.foundDevicesInGroup = 0
            node.firmwareResponsesInGroup = 0

            try{
                node.requestIdGroup = Number(req.query.group)

                // request Id from group
                var msg = Buffer.from([0xAA, 0x10, 0x30, node.node,node.group, 0xFF,0xFF,0x00, req.query.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                node.send({payload: msg})
                
                await waitForNewDevicesAsync()

                if(node.foundDevicesInGroup > 0 )
                {
                    // request firmware type from group
                    var msg = Buffer.from([0xAA, 0x10, 0x50, node.node,node.group, 0xFF,0xFF,0x00, req.query.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
                    node.send({payload: msg})

                    await waitForFirmwareResponseAsync()
                }
            }
            catch(e)
            {console.log(e)}

            res.json(JSON.stringify(node.devices));
            
        });

        class HapcanDevice {
            constructor() {
                this.node = 0;
                this.group = 0;
                this.serialNumber = 0;
                this.hardwareType = 0
                this.hardwareTypeString = 'unknown'
                this.hardwareVersion = 0
                this.applicationType = 0
                this.applicationTypeString = 'unknown'
                this.applicationVersion = 0
                this.firmwareVersion = 0
            }
        }

        //hardware type response
        node.eventEmitter.on('messageReceived_103', function(data){
            
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            var device = null
            var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
            if( !node.devices.hasOwnProperty(deviceId) )
            {
                node.devices[deviceId] = new HapcanDevice()
                node.foundDevicesInGroup += 1
            }
                
            device = node.devices[deviceId]
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
        node.eventEmitter.on('messageReceived_105', function(data){
                    
            var hapcanMessage = data.payload
            if(node.requestIdGroup !== Number(hapcanMessage.group))
                return;

            var device = null
            var deviceId = ('00'+ hapcanMessage.node.toString(16)).substr(-2).toUpperCase() + ('00'+ hapcanMessage.group.toString(16)).substr(-2).toUpperCase()
            if( !node.devices.hasOwnProperty(deviceId) )
            {
                return;
            }

            node.firmwareResponsesInGroup += 1
            device = node.devices[deviceId]
            device.hardwareVersion = hapcanMessage.frame[7]
            device.applicationType = hapcanMessage.frame[8]
            switch(device.applicationType)
            {
                case 0x01: device.applicationTypeString = 'Button'; break
                case 0x02: device.applicationTypeString = 'Relay'; break
                case 0x03: device.applicationTypeString = 'IR Receiver'; break
                case 0x04: device.applicationTypeString = 'Temperature sensor'; break
                case 0x05: device.applicationTypeString = 'Infrared transmitter'; break
                case 0x06: device.applicationTypeString = 'Dimmer'; break
                case 0x07: device.applicationTypeString = 'Blind controller'; break
                case 0x08: device.applicationTypeString = 'Led controller'; break
                case 0x09: device.applicationTypeString = 'Open collector'; break
                
                default:
                    device.hardwareTypeString = 'Custom device'
            }
            device.applicationVersion = hapcanMessage.frame[9]
            device.firmwareVersion = hapcanMessage.frame[10]
        })        
    }
    RED.nodes.registerType("hapcan-gateway", HapcanGatewayNode);
}