const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const { assert } = require("chai");
const helper = require("node-red-node-test-helper");
const gatewayNode = require("../hapcan-gateway.js");

const hapcanNodes = [gatewayNode];

helper.init(require.resolve('node-red'));

describe('HAPCAN Gateway Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    const flow = [
        { id: "g1", type: "hapcan-gateway", name: "gateway-name", host: "host", port: 1234, group: 1, node: 1, debugmode: true },
    ];

    it('should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            try {
                g1.should.have.property('name', 'gateway-name');
                assert.isNotNull(g1.eventEmitter);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should invoke the callback', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('foo', spy);
                assert(spy.notCalled);
                emitter.emit('foo');
                assert(spy.calledOnce);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should pass arguments to the callbacks', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('foo', spy);
                assert(spy.notCalled);
                emitter.emit('foo', 'bar', 'baz');
                assert(spy.calledOnce);
                assert(spy.withArgs('bar', 'baz').calledOnce);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('messageToString', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const frame = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const g1 = helper.getNode("g1");
            try {
                const msgText = g1.messageToString(frame);
                assert.equal(' 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F', msgText);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should emit messageReceived event', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const frame = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('messageReceived', spy);
                assert(spy.notCalled);

                g1.messageReceived(frame);
                assert(spy.calledOnce);
                // console.log(spy.lastCall.args[0]);
                // assert(spy.withArgs(spy.lastCall.args[0]).calledOnce);

                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should emit messageReceived_304 event', function (done) {
        const spy = sinon.spy();
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
            const emitter = g1.eventEmitter;
            try {
                emitter.on('messageReceived_304', spy);
                assert(spy.notCalled);

                g1.messageReceived(frame);
                assert(spy.calledOnce);
                // console.log(spy.lastCall.args[0]);
                // assert(spy.withArgs(spy.lastCall.args[0]).calledOnce);

                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    // it('should emit event', function (done) {
    //     helper.load(hapcanNodes, flow, function () {
    //         const gateway = helper.getNode("g1");
    //         node.on('send', function () {
    //             try {
    //                 node.should.have.property('payload.temp', -127.0);
    //                 done();
    //             } catch (err) {
    //                 done(err);
    //             }
    //         });

    //         const frame =
    //             [
    //                 0xAA,
    //                 0x30,
    //                 0x40,
    //                 30,
    //                 7,
    //                 0xFF,
    //                 0xFF,
    //                 0x11,
    //                 0xF8,
    //                 0x10,
    //                 0xFF,
    //                 0xFF,
    //                 0xFF,
    //                 0xA9,
    //                 0xA5
    //             ];
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
