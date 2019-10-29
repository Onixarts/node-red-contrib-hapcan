 module.exports = function(RED) {

    function ButtonInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
		node.channelFilter = config.channelFilter;
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.gateway.eventEmitter.on('statusChanged', function(data){
            node.status(data)
        })

        node.gateway.eventEmitter.on('messageReceived_301', function(data){
            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;

            if((node.channelFilter & (1 << (hapcanMessage.frame[7] - 1))) === 0)
                return;

            switch (hapcanMessage.frame[8]){
                case 0x00: hapcanMessage.state = "OPEN";break;
                case 0x01: hapcanMessage.state = "DISABLED"; break;
				case 0xFF: hapcanMessage.state = "CLOSED";break;
				case 0xFE: hapcanMessage.state = "HELD_400ms";break;
				case 0xFD: hapcanMessage.state = "HELD_4s";break;
				case 0xFC: hapcanMessage.state = "RELEASED_BEFORE_400ms";break;
				case 0xFB: hapcanMessage.state = "RELEASED_AFTER_400ms";break;
                case 0xFA: hapcanMessage.state = "RELEASED_AFTER_4s";break;
                case 0xF1: hapcanMessage.state = "HELD_1s";break;
                case 0xFA: hapcanMessage.state = "RELEASED_AFTER_1s";break;
                default: 
                    node.warn('Button state value unknown:' + hapcanMessage.frame[8]);
                    hapcanMessage.state = 'undefined';
				
            }
            
            hapcanMessage.channel = hapcanMessage.frame[7];
            switch( hapcanMessage.frame[9] )
            {
                case 0x00 : hapcanMessage.led = 'OFF'; break;
                case 0x01 : hapcanMessage.led = 'DISABLED'; break;
                case 0xFF : hapcanMessage.led = 'ON'; break;
                default:
                    node.warn('Led value unknown:' + hapcanMessage.frame[9]);
                    hapcanMessage.led = 'undefined';
            }

            node.send({topic: 'Button message', payload: hapcanMessage});
        });

        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("button-input",ButtonInputNode);
}