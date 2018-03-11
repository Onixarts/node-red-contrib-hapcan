module.exports = function(RED) {
    function StateOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) +'_';

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
			// jeżeli node=0 wysyła zapytanie o status grupy
			if (node.node == 0) {
				var hapcanMsg = Buffer.from([0xAA, 0x10,0x80, 0xF0,0xF0, 0xFF,0xFF, 0x00,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);				
			} 
			else {
				var hapcanMsg = Buffer.from([0xAA, 0x10,0x90, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
			}
            
            msg.payload = hapcanMsg;
            msg.topic = 'control';
            node.gateway.send(msg);
        });
        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("state-output",StateOutputNode);

}