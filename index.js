const uuidv4 = require('uuid/v4')
const sharp = require('sharp');
let multer = require('multer')
const fs = require('fs')
let destx = 'uploads/';
let upload = multer({
    dest: destx
});
let bodyParser = require('body-parser')
var path = require('path');
var admin = require('firebase-admin');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
app.use(bodyParser.json({
    type: 'application/json'
}))
var serviceAccount = require("./serviceAccountKey.json");
let lastupd="";

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://snt-website.firebaseio.com",
    storageBucket: "snt-website.appspot.com"
});
var bucket = admin.storage().bucket();

async function uploadFile(filename, ud) {
    let destination = "resized/" + filename
    let options = {
        destination,
        gzip: true,
        metadata: {
            cacheControl: 'no-cache',
            metadata: {
                firebaseStorageDownloadTokens: ud
            }
        },
    }
    return bucket.upload(filename, options, function (err, file) {console.log(err)});
}

async function getCropping(filePath) {
    var request = require('request'),
        apiKey = 'acc_354fd36774e546d',
        apiSecret = '5504609623e6a0ae65cc4777e3098a8c',
        formData = {
            image: fs.createReadStream(filePath),
            resolution: '4x3'
        },
        respo,
        dx = new Promise(function(res, rej){
            request.post({
                url: 'https://api.imagga.com/v2/croppings',
                formData: formData
            }, function (error, response, body) {
                respo = body
                res();
                console.log(error)
            }).auth(apiKey, apiSecret, true);
        })
    await dx;
    return respo;
}

async function cropOutImage(originalImage, x1, x2, y1, y2, outputImage) {
    let width = x2 - x1,
        height = y2 - y1,
        left = x1,
        top = y1;
    await sharp(originalImage).extract({
        width,
        height,
        left,
        top
    }).toFile(outputImage);
}

app.post('/putImage', upload.single('image'), async (req, res, next) => {
    if(lastupd!="")
        fs.unlinkSync(lastupd)
    let ud = uuidv4()
    let outputImage = ud+(req.file.originalname).substring((req.file.originalname).indexOf('.'));
    let urlToSend = `https://firebasestorage.googleapis.com/v0/b/snt-website.appspot.com/o/resized%2F${outputImage}?alt=media&token=${ud}`
    let src = destx + req.file.filename;
    let cord = JSON.parse(await getCropping(src));
    cord = cord.result.croppings[0]
    let x1 = cord.x1,   
        x2 = cord.x2,
        y1 = cord.y1,
        y2 = cord.y2;
    await cropOutImage(src, x1, x2, y1, y2, outputImage);
    fs.unlinkSync(src)
    await uploadFile(outputImage, ud)
    lastupd = outputImage
    // res.sendFile(path.join(__dirname, outputImage))
    res.json({
        "url": urlToSend
    })
    res.end()
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'))
})

app.listen(port, function () {
    console.log('Server is running on PORT', port);
});