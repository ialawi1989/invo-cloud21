const express = require('express');

var path = require('path')
const app = express();
const port = process.env.PORT || 3000;

var fs = require('fs');

let data = JSON.stringify(Config);
fs.writeFileSync('assets/configration.json', data);


app.use(express.static(path.join(__dirname, '/')));


app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
})



app.listen(port, () => {

});
