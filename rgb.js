module.exports = function(RED) {
    function RGBOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.channel = config.channel;
        node.state = config.state;
        node.speed = config.speed;
        
        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) + ("00" + node.channel).slice (-3)+'_';

        this.status({fill: "grey", shape: "dot", text: "not registered to gateway"});

        if(node.gateway)
        {
            node.gateway.register(node);
        }
        else
        {
            node.error('Invalid configuration. Gateway is required.'); 
        }

        this.on('close', function(done) {
            if (node.gateway) {
                node.gateway.deregister(node,done);
            }
        });

        node.on('input', function(msg) {
            
            var control = { 
                channel: Number(node.channel), 
                state: Number(node.state),
                speed: Number(node.speed),
                delay: 0x00,

                command: 0xFF,
                sendSpeedMessage: true,
            }

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'object')
                {
                    if( msg.payload.hasOwnProperty('speed'))
                    {
                        if(typeof msg.payload.speed === 'number')
                        {
                            if(msg.payload.speed < 0)
                                control.speed = 0;
                            else if(msg.payload.speed > 255)
                                control.speed = 255;
                            else
                                control.speed = msg.payload.speed;
                        }
                        else
                        {
                            node.error('Invalid speed type: '+ typeof msg.payload.speed); 
                            return;
                        }
                    }
                    if( msg.payload.hasOwnProperty('channel'))
                    {
                        control.channel = 0;
                        if(typeof msg.payload.channel === 'number')
                        {
                            if(!isChannelValid(msg.payload.channel))
                                return;
                            control.channel = msg.payload.channel;
                        }
                        else if(typeof msg.payload.channel === "string")
                        {
                            switch(msg.payload.channel.toUpperCase())
                            {
                                case "RED": control.channel = 0x01; break;
                                case "GREEN": control.channel = 0x02; break;
                                case "BLUE": control.channel = 0x03; break;
                                case "MASTER": control.channel = 0x04; break;
                                default: 
                                    node.error('Invalid channel name value: '+ msg.payload.channel); 
                                    return;
                            }
                        }
                        if( msg.payload.hasOwnProperty('state'))
                        {
                            if(!parseAction(msg.payload.state, control))
                                return;
                        }                        
                        else
                        {
                            node.error('Invalid channel type: '+ typeof msg.payload.channel); 
                            return;
                        }
                    }
                }
                else
                {
                    if(!parseAction(msg.payload, control))
                        return;
                }
            }

            if( !isChannelValid(control.channel))
            {
                node.error('Invalid channel: ' + control.channel);
                return;
            }

            if( control.sendSpeedMessage)
                control.sendSpeedMessage = control.speed > 0;

            if( control.sendSpeedMessage)
            {   
                let command = 0x1B + control.channel;
                let hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF, 0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]); 
                
                hapcanMsg[5] = command;
                hapcanMsg[6] = control.speed-1;

                msg.payload = hapcanMsg;
                msg.topic = 'control';
                node.gateway.send(msg);
            }
            
            if( control.command === 0xFF)
            {
                //speed determines if channel will be switch instantly or softly
                if(control.speed === 0)
                    control.command = 0x00 + control.channel - 1;
                else
                    control.command = 0x0F + control.channel;
            }  

            var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
            hapcanMsg[5] = control.command;
            hapcanMsg[6] = control.state;
            hapcanMsg[9] = control.delay;

            msg.payload = hapcanMsg;
            msg.topic = 'control';
            node.gateway.send(msg);
        });
        this.on('close', function() {
            // tidy up any state
        });

        function isChannelValid(channel)
        {
            var isValid = (channel >= 1 && channel <= 4);
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
                    case "OFF": control.state = 0x00; 
                                break;
                    case "ON":  control.state = 0xFF; 
                                break;
                    case "TOGGLE": 
                                if( control.speed === 0)
                                {
                                    control.command = 0x03 + control.channel;
                                    control.sendSpeedMessage = false;
                                }
                                else 
                                    control.command = 0x17 + control.channel;
                                break;
                    case "STOP":
                                control.command = 0x13 + control.channel;
                                control.sendSpeedMessage = false;
                                break;                                
                    default:
                        node.error('Invalid action string: '+ value);
                    return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 255)
                {
                    node.error('Invalid state number value: '+ value);
                    return false;
                }
                control.state = value;
            }
            else if(typeof value === 'boolean')
            {
                control.state = value != false ? 0xFF : 0x00;
            }
            return true;
        }

    }
    RED.nodes.registerType("rgb-output",RGBOutputNode);

    function RGBInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.channelFilter = config.channelFilter;
        
        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) + '_';

        this.status({fill: "grey", shape: "dot", text: "not registered to gateway"});

        if(node.gateway)
        {
            node.gateway.register(node);
        }
        else
        {
            node.error('Invalid configuration. Gateway is required.'); 
        }

        this.on('close', function(done) {
            if (node.gateway) {
                node.gateway.deregister(node,done);
            }
        });

        node.gateway.eventEmitter.on('messageReceived_308', function(data){
            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;

            if((node.channelFilter & (1 << (hapcanMessage.frame[7] - 1))) === 0)
                 return;

            hapcanMessage.status = hapcanMessage.frame[8];
            if(hapcanMessage.frame[7] == 0x04)
                hapcanMessage.relay = hapcanMessage.frame[9] === 0x00 ? "OFF" : "ON";
            else
                hapcanMessage.relay = "undefined";

            hapcanMessage.enabled = hapcanMessage.frame[8] === 0x00 ? false : true;
            hapcanMessage.channel = hapcanMessage.frame[7];
            switch(hapcanMessage.frame[7])
            {
                case 0x01: hapcanMessage.channelName = "RED"; break;
                case 0x02: hapcanMessage.channelName = "GREEN"; break;
                case 0x03: hapcanMessage.channelName = "BLUE"; break;
                case 0x04: hapcanMessage.channelName = "MASTER"; break;
            }

            data.topic = 'RGB message';

            node.send(data);
        });

        this.on('close', function() {
            // tidy up any state
        });
    }
    RED.nodes.registerType("rgb-input",RGBInputNode);
}