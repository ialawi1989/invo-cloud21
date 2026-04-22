// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-var-requires
var path = require('path')
const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, '/')));


app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
})


app.listen(port, () => {
    console.log('server started')
    console.log('on port 8081')

});