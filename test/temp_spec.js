// const log = require('why-is-node-running');
//const should = require("should");
const sinon = require('sinon');
const { assert } = require("chai");
const EventEmitter = require('events').EventEmitter;
const helper = require("node-red-node-test-helper");
const temperatureNode = require("../temp.js");
const gatewayNode = require("../hapcan-gateway.js");
const inputHelperNode = require("./input-helper.js");

const hapcanNodes = [gatewayNode, temperatureNode, inputHelperNode];

helper.init(require.resolve('node-red'));

describe('HAPCAN Temperature Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    const flow = [
        { id: "g1", type: "hapcan-gateway", name: "gateway-name", host: "host", port: 1234, group: 1, node: 1, debugmode: true },
        { id: "n1", type: "temp-input", name: "temperature-name", gateway: "g1", group: 7, node: 30, wires: [["input.helper"]] },
        { id: "input.helper", type: "input-helper", name: "input-helper-name" },
    ];

    it('temp should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const n1 = helper.getNode("n1");
            try {
                n1.should.have.property('name', 'temperature-name');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('input-helper should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.should.have.property('name', 'input-helper-name');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('temperature value FIXME', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0xF8,
                    0x10,
                    0xFF,
                    0xFF,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        console.log(msg);
                        assert.equal(0x304, msg.payload.frameType);
                        assert.equal(false, msg.payload.isAnswer);
                        assert.equal(30, msg.payload.node);
                        assert.equal(7, msg.payload.group);
                        assert.equal(0x11, msg.payload.type);
                        assert.equal(-127, msg.payload.temp);
                        // assert.equal(0, msg.payload.setpoint);
                        // assert.equal(16.0, msg.payload.hysteresis);
                        done();
                    }
                    catch (err) {
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    // it('get temperature 1.0°C', function (done) {
    //     helper.load(hapcanNodes, flow, function () {
    //         const gateway = helper.getNode("g1");
    //         const node = helper.getNode("n1");
    //         node.on('send', function () {
    //             try {
    //                 node.should.have.property('payload.temp', -127.0);
    //                 done();
    //             } catch (err) {
    //                 done(err);
    //             }
    //         });

    //         //gateway.debugmode = true;
    //         //gateway.incommingMessage = frame;
    //         //gateway.eventEmitter.emit('messageReceived_304');
    //         node.gateway.eventEmitter.emit('messageReceived_304');
    //         //gateway.receive(frame);
    //         //node.receive({ payload: frame });
    //         // "frameType": 0x304,
    //         // "isAnswer": false,
    //         // "node": 30,
    //         // "group": 7,
    //         // "type": 17, 11
    //         // "temp": 3969, // !!! -127.0000
    //         // "setpoint": 4095.94, // !!! -0.0625
    //         // "hysteresis": 15.9375 // !!! 16.0000
    //     });
    //});

    //   it('should make payload lower case', function (done) {
    //     var flow = [
    //       { id: "n1", type: "lower-case", name: "lower-case",wires:[["n2"]] },
    //       { id: "n2", type: "helper" }
    //     ];
    //     helper.load(lowerNode, flow, function () {
    //       var n2 = helper.getNode("n2");
    //       var n1 = helper.getNode("n1");
    //       n2.on("input", function (msg) {
    //         try {
    //           msg.should.have.property('payload', 'uppercase');
    //           done();
    //         } catch(err) {
    //           done(err);
    //         }
    //       });
    //       n1.receive({ payload: "UpperCase" });
    //     });
    //   });
});

// setTimeout(function () {
//     log() // logs out active handles that are keeping node running
// }, 5000);
