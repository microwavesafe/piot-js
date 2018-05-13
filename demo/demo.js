const Piot = require('piot')

Piot.list().then(function(list){
    let piot = new Piot(list[0].comName);

    piot.on('open', () => {
        console.log("opened serial port");
        piot.closeRadioSocket(7627);
        piot.openRadioSocket(0, 7627, 0, 0, 0, new Uint8Array(32));
        piot.sendRadioPacket(1234567, 7627, new Uint8Array([0,1,2,3,4]));
    });

    piot.on('error', (err) => {
        console.log(err);
    });

    piot.on('data', (data) => {
        let hexString = '';
        for (let i=0; i<data.length; i++) {
            hexString += ('0' + (data[i] & 0xFF).toString(16)).slice(-2);
        }
        console.log(hexString);
    });
});

