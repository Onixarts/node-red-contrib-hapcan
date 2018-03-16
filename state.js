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
              if(typeof msg.payload === 'object')
              {
                  if( msg.payload.hasOwnProperty('modul'))
                  {
                        if(typeof msg.payload.modul === 'number') {
                            if (isGroupValid(msg.payload.modul)) {
                                control[0] = {group: msg.payload.modul,
                                            node: 0};
                            }
                        }
                        else if (Array.isArray(msg.payload.modul)){
                            if (typeof msg.payload.modul[0] === 'number'){
                                if (isGroupValid(msg.payload.modul[0])) {
                                    control[0] = {gropu: msg.payload.modul[0],
                                                node : 0};
                                    if (isNodeValid(msg.payload.modul[1])) {
                                        control[0].node = msg.payload.modul[1];
                                    } 
                                }
                            }
                            else if(typeof msg.payload.modul[0] === 'object') {
                                for (var i=0; i < msg.payload.modul.length; i++) {
                                    if (msg.payload.modul[i].hasOwnProperty('group')) {
                                        if (isGroupValid(msg.payload.modul[i].group)) {
                                            control[0] = {group: msg.payload.modul[i].group,
                                                        node: 0};
                                            if (msg.payload.modul[i].hasOwnProperty('node')) {
                                                if (isNodeValid(msg.payload.modul[i].node)) {
                                                    control[i].node = msg.payload.modul[i].node
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else if(typeof msg.payload.modul === 'object') { 
                            if (msg.payload.modul.hasOwnProperty('group')){
                                if (isGroupValid(msg.payload.modul.group)) {
                                    control[0] = {group: msg.payload.modul.group,
                                                node : 0 };
                                    if (msg.payload.modul.hasOwnProperty('node')) {
                                        if (isNodeValid(msg.payload.modul.node)) {
                                            control[0].node = msg.payload.modul.node;
                                        }
                                    } 
                                }
                            }
                        }
                        else {
                            node.log("nieprawidłowa wartość msg.payload.modul");
                        }
                    }
                }
            }
            for (var i=0; i<control.length; i++){
                if (control[i].node === 0 ) {
                    var hapcanMsg = Buffer.from([0xAA, 0x10,0x80, 0xF0,0xF0, 0xFF,0xFF, 0x00,control[i].group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);    
                }
                else {
                    var hapcanMsg = Buffer.from([0xAA, 0x10,0x90, 0xF0,0xF0, 0xFF,0xFF, control[i].node,control[i].group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);    
                }
                msg.payload = hapcanMsg;
                msg.topic = 'control';
                node.gateway.send(msg);
            }
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

    }
    RED.nodes.registerType("state-output",StateOutputNode);

}