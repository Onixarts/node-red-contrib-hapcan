module.exports = function(RED) {
    function IRInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.filter = config.filter;
        
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

            hapcanMessage.codeType = "";
            hapcanMessage.address = 0x00;
            hapcanMessage.command = 0x00;
            hapcanMessage.startMessage = true;

            var tempCodeTyped = hapcanMessage.frame[7];

            if(tempCodeTyped > 0x80)
            {
                tempCodeTyped -= 0x80;
                hapcanMessage.startMessage = false;
                if(Number(node.filter) === 1)
                    return;
            }
            else if( Number(node.filter) === 2)
                return;

            hapcanMessage.address = hapcanMessage.frame[8];
            hapcanMessage.command = hapcanMessage.frame[9];

            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, 'ir', 1)
            hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            switch(tempCodeTyped)
            {
                case 0x03: hapcanMessage.codeType = 'SIRC12'; break;
                case 0x04: hapcanMessage.codeType = 'SIRC15'; break;
                case 0x05: hapcanMessage.codeType = 'SIRC20'; 
                            hapcanMessage.address = (int)(hapcanMessage.frame[8]<<8)+hapcanMessage.frame[9]; 
                            hapcanMessage.command = hapcanMessage.frame[10];  
                            break;
                case 0x06: hapcanMessage.codeType = 'RC5';  break;
                case 0x07: hapcanMessage.codeType = 'NEC16'; break;
                case 0x08: hapcanMessage.codeType = 'NEC24'; 
                            hapcanMessage.address = (int)(hapcanMessage.frame[8]<<8)+hapcanMessage.frame[9]; 
                            hapcanMessage.command = hapcanMessage.frame[10];
                            break;
                default: console.warn(`Unknown IR message type received: ${hapcanMessage.frame[7].toString('hex')}`); return;
            }

            node.send({topic: 'IR message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_303', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_303', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });        
    }
    RED.nodes.registerType("ir-input",IRInputNode);
}