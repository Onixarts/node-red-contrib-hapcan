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
   
          var control=[];
          control[0] =  { node: Number(node.node),
                       group: Number(node.group)
          };

          if(msg.topic === "control" )
          {
            if( msg.hasOwnProperty('payload'))
            {
                if(typeof msg.payload === 'number') {
                    if (isGroupValid(msg.payload)) {
                        control[0] = {group: msg.payload,
                                    node: 0};
                    }
                }
                else if (Array.isArray(msg.payload)){
                    if (typeof msg.payload[0] === 'number'){
                        if (isGroupValid(msg.payload[0])) {
                            control[0] = {group: msg.payload[0],
                                        node : 0};
                            if (isNodeValid(msg.payload[1])) {
                                control[0].node = msg.payload[1];
                            } 
                        }
                    }
                    else if(typeof msg.payload[0] === 'object') {
                        for (var i=0; i < msg.payload.length; i++) {
                            if (msg.payload[i].hasOwnProperty('group')) {
                                if (isGroupValid(msg.payload[i].group)) {
                                    control[i] = {group: msg.payload[i].group,
                                                node: 0};
                                    if (msg.payload[i].hasOwnProperty('node')) {
                                        if (isNodeValid(msg.payload[i].node)) {
                                            control[i].node = msg.payload[i].node
                                        }
                                    }
                                }
                                node.log("msg:"+msg.payload[i].group+":"+msg.payload[i].node);
                                node.log("control:"+control[i].group+":"+control[i].node);
                            }
                        }
                    }
                }
                else if(typeof msg.payload === 'object') { 
                    if (msg.payload.hasOwnProperty('group')){
                        if (isGroupValid(msg.payload.group)) {
                            control[0] = {group: msg.payload.group,
                                        node : 0 };
                            if (msg.payload.hasOwnProperty('node')) {
                                if (isNodeValid(msg.payload.node)) {
                                    control[0].node = msg.payload.node;
                                }
                            } 
                        }
                    }
                }
                else {
                    node.log("nieprawidłowa wartość msg.payload");
                }
              }

            }
              
            sendMessage(control, node, msg);
            
        });
        this.on('close', function() {
            // tidy up any state
        });

        function isNodeValid(nodeNr)
        {
            var isValid = (nodeNr >= 0 && nodeNr < 255);
            if(!isValid)
                node.error('Invalid node: '+ nodeNr);
            return isValid;
        }
        function isGroupValid(groupNr)
        {
            var isValid = (groupNr > 0 && groupNr < 255);
            if(!isValid)
                node.error('Invalid group: '+ groupNr);
            return isValid;
        }
        function sleep(ms){
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        async function sendMessage(control, node, msg){
            for (var i=0; i<control.length; i++){
                if (control[i].node === 0 ) {
                    var hapcanMsg = Buffer.from([0xAA, 0x10,0x80, 0xF0,0xF0, 0xFF,0xFF, 0x00,control[i].group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);    
                }
                else {
                    var hapcanMsg = Buffer.from([0xAA, 0x10,0x90, 0xF0,0xF0, 0xFF,0xFF, control[i].node,control[i].group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);    
                }
                msg.payload = hapcanMsg;
                msg.topic = 'control';
                await sleep(1000);
                node.gateway.send(msg);
            }
        }
    }
    RED.nodes.registerType("state-output",StateOutputNode);

}