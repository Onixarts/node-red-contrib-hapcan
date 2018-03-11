 module.exports = function(RED) {

    function ButtonInputNode(config) {
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
				case 0xFE: hapcanMessage.state = "CLOSED_HELD_400";break;
				case 0xFD: hapcanMessage.state = "CLOSED_HELD_4000";break;
				case 0xFC: hapcanMessage.state = "CLOSED_OPENED_400";break;
				case 0xFB: hapcanMessage.state = "CLOSED_OPENED_400_4000";break;
				case 0xFA: hapcanMessage.state = "CLOSED_OPENED_4000";break;
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