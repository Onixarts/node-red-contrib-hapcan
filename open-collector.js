module.exports = function(RED) {
    function OpenCollectorOutputNode(config) {
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
            if( control.channels === 0 ) {
                done()
                return;
            }
            
            var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
            hapcanMsg[5] = control.action;

            hapcanMsg[6] = control.channels & 0xFF;
            hapcanMsg[9] = ((control.channels & 0x0300) >> 8) & 0xFF;

            hapcanMsg[10] = control.delay;
            
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
            var isValid = (channel > 0 && channel < 11);
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
                    case "OFF": control.action = 0x00; break;
                    case "ON": control.action = 0x01; break;
                    case "TOGGLE": control.action = 0x02; break;
                    default:
                        done('Invalid action string: '+ value);
                        return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 2)
                {
                    done('Invalid action number value: '+ value);
                    return false;
                }
                control.action = value;
            }
            else if(typeof value === 'boolean')
            {
                control.action = value != false ? 0x01 : 0x00;
            }
            return true;
        }

    }
    RED.nodes.registerType("open-collector-output",OpenCollectorOutputNode);

    function OpenCollectorInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.channelFilter = config.channelFilter;
        node.userFieldStateON = config.userFieldStateON;
        node.userFieldStateOFF = config.userFieldStateOFF;
        
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

            hapcanMessage.state = hapcanMessage.frame[8] === 0x00 ? 'OFF' : 'ON';
            hapcanMessage.enabled = hapcanMessage.frame[8] === 0x00 ? false : true;
            hapcanMessage.channel = hapcanMessage.frame[7];
            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, 'oc', hapcanMessage.channel)
            hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            hapcanMessage.userField = hapcanMessage.state === 'ON' ? node.userFieldStateON : node.userFieldStateOFF;

            node.send({topic: 'Open Collector message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_309', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_309', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

        function isChannelValid(channel)
        {
            var isValid = (channel > 0 && channel < 11);
            if(!isValid)
                node.error('Invalid channel: '+ channel);
            return isValid;
        }

        function parseAction(value, control)
        {
            if(typeof value === "string" )
            {
                switch(value.toUpperCase())
                {
                    case "OFF": control.action = 0x00; break;
                    case "ON": control.action = 0x01; break;
                    case "TOGGLE": control.action = 0x02; break;
                    default:
                    node.error('Invalid action string: '+ value);
                    return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 2)
                {
                    node.error('Invalid action number value: '+ value);
                    return false;
                }
                control.action = value;
            }
            return true;
        }

    }
    RED.nodes.registerType("open-collector-input",OpenCollectorInputNode);
}