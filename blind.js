module.exports = function(RED) {
    function BlindOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.channel = config.channel;
        node.defaultAction = config.defaultAction;

        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.on('input', function(msg, send, done) {
            
            var control = { 
                channels: Number(node.channel), 
                action: Number(node.defaultAction),
                delay: 0x00
            }

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'object')
                {
                    if( msg.payload.hasOwnProperty('action'))
                    {
                        if(!parseAction(msg.payload.action, control, done))
                            return;
                    }
                    if( msg.payload.hasOwnProperty('channels'))
                    {
                        control.channels = 0;
                        if(typeof msg.payload.channels === 'number')
                        {
                            if(!isChannelValid(msg.payload.channels, done))
                                return;
                            control.channels = 0x01 << (msg.payload.channels -1);
                        }
                        else if(Array.isArray(msg.payload.channels))
                        {
                            for(var i = 0; i < msg.payload.channels.length; i++)
                            {
                                if(!isChannelValid(msg.payload.channels[i], done))
                                    return;
                                control.channels |= 0x01 << (msg.payload.channels[i] - 1);
                            }
                        }
                        else
                        {
                            done('Invalid channels type: '+ typeof msg.payload.channels); 
                            return;
                        }
                    }
                }
                else
                {
                    if(!parseAction(msg.payload, control, done))
                        return;
                }
            }

            if( control.action === -1 ){
                done()
                return;
            }
            if( control.channels === 0 ){
                done()
                return;
            }

            var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
            hapcanMsg[5] = control.action;
            hapcanMsg[6] = control.channels;
            hapcanMsg[9] = control.delay;

            msg.payload = hapcanMsg;
            msg.topic = 'control';
            node.gateway.send(msg);
            done()
        });

        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });        

        function isChannelValid(channel, done)
        {
            var isValid = (channel >= 1 && channel <= 3);
            if(!isValid)
                done('Invalid channel: '+ channel);
            return isValid;
        }

        function parseAction(value, control, done)
        {
            if(typeof value === "string" )
            {
                switch(value.toUpperCase())
                {
                    case "STOP": control.action = 0x00; break;
                    case "UP/STOP": control.action = 0x01; break;
                    case "DOWN/STOP": control.action = 0x02; break;
                    case "UP": control.action = 0x03; break;
                    case "DOWN": control.action = 0x04; break;
                    case "START": control.action = 0x05; break;
                    default:
                        done('Invalid action string: '+ value);
                        return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 5)
                {
                    done('Invalid action number value: '+ value);
                    return false;
                }
                control.action = value;
            }
            return true;
        }
    }
    RED.nodes.registerType("blind-output",BlindOutputNode);

    function BlindInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.channelFilter = config.channelFilter;
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.messageReceived = function(data)
        {
            
            var hapcanMessage = data.payload;

            if( (Number(node.node)!== 0 && hapcanMessage.node != node.node) || (Number(node.group)!== 0 && hapcanMessage.group != node.group) )
                return;

            if((node.channelFilter & (1 << (hapcanMessage.frame[7] - 1))) === 0)
                return;

            hapcanMessage.status = hapcanMessage.frame[8];
            hapcanMessage.statusPercent = Number(Number((100 * hapcanMessage.frame[8]) / 255).toFixed(0));
            switch(hapcanMessage.frame[9])
            {
                case 0x00: hapcanMessage.move = 'STOPPED'; break;
                case 0x01: hapcanMessage.move = 'DOWN'; break;
                case 0x02: hapcanMessage.move = 'UP'; break;
                default: 
                    node.warn('Blind move value unknown:' + hapcanMessage.frame[9]);
                    hapcanMessage.move = 'undefined';
            }
            hapcanMessage.channel = hapcanMessage.frame[7];
            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, hapcanMessage.channel)
            hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            node.send({topic: 'Blind message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_307', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_307', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });        

    }
    RED.nodes.registerType("blind-input",BlindInputNode);
}