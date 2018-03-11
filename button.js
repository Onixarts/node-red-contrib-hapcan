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
				case 0xFF: hapcanMessage.state = "CLOSED";break;
				case 0xFE: hapcanMessage.state = "CH400ms";break;
				case 0xFD: hapcanMessage.state = "CH4s";break;
				case 0xFC: hapcanMessage.state = "CO400ms";break;
				case 0xFB: hapcanMessage.state = "CO400-4";break;
				case 0xFA: hapcanMessage.state = "CO4s";break;
                default: 
                    node.warn('Button state value unknown:' + hapcanMessage.frame[9]);
                    hapcanMessage.state = 'undefined';
				
			}

			hapcanMessage.channel = hapcanMessage.frame[7];
			
            node.send({topic: 'Button message', payload: hapcanMessage});
        });

        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("button-input",ButtonInputNode);
}