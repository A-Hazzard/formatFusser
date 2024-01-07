const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const AWS = require('aws-sdk');



// const ffmpeg = require('node-ffmpeg')

const multer = require('multer') //for file uploads
const path = require('path');

AWS.config.update({
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY_ID,
  });
  
  const s3 = new AWS.S3({
    endpoint: process.env.SECRET_ENDPOINT,
  });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Specify the directory to save files
    },
    filename: function (req, file, cb) {
        // Use the original file name and append the current timestamp
        // to make the filename unique
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    //File types
    const fileType = /jpeg|jpg|png|gif|mp4|mp3|wav|mov/;
    //Check to see if the fileType is valid 
    const isValidType = fileType.test(path.extname(file.originalname).toLocaleLowerCase());

    if(isValidType) cb(null, true); //Accept the file
    else cb(new Error('Unsupported file type'), false); // Reject invalid file type
};


// const upload = multer({ storage: storage, fileFilter});
const upload = multer({ storage: multer.memoryStorage(), fileFilter });

// Conversation route
router.post('/convertFile', upload.single('file'), (req, res) => {
 
    if(!req.file) {
        console.error('Unsupported file type');
        return res.status(400).send('Unsupported file type')
    } 

    const { 
        decision, 
        desiredFileType, 
        desiredResolution, 
        fpsValue,
        startTime, endTime

    } = req.body;
    console.log(desiredFileType)
   
    const file = req.file.path;
    const supportedResolutions = ['360', '480', '720', '1080', '1440', '2160'] //pixel values are height measured
    console.log(`Decision: ${decision}, \n`)
    switch(decision){
        case "file conversion" : convertFile(file, desiredFileType, res, req);
        break;

        case "fps modification" : changeFPS(file, fpsValue, res);
        break;

        case "crop video" : cropVideo(file, startTime, endTime, res);
        break;

        case "resolution modification" : resolutionModification(file, desiredResolution, supportedResolutions, res, req)
        break;

        case "audio extraction" : extractAudioFromVideo(file, res);
        break;

        case "reduce noise" : noiseReduction(file, res);
        break;

        

        

        default: 
            console.error("Invalid request");
            res.status(400).send('Invalid request')
            
    }
});



// Temporary store for file paths
let filePaths = {};

const convertFile = async (video, desiredFileType, res, req) => {
    // Use a directory that is not managed by OneDrive, for example, a directory within the project
    const outputDirectory = path.resolve(__dirname, './conversions');

    if (!fs.existsSync(outputDirectory)){
        fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const outputFileName = `${Date.now()}_converted.${desiredFileType}`;
    const outputPath = path.join(outputDirectory, outputFileName);

    console.log('Converting file to', desiredFileType);
    ffmpeg(video)
        .output(outputPath)
        .on('end', async () => {

            // Instead of reading the file into a buffer, create a read stream
            // This avoids loading the entire file into memory, which is more efficient
            const readStream = fs.createReadStream(outputPath);

            const wasabiParams = {
                Bucket: process.env.WASABI_BUCKET_NAME,
                Key: path.basename(outputPath),
                Body: readStream,
            };
            console.log(`File converted and available at ${outputPath}`);

            try {
                const wasabiUploadResult = await s3.upload(wasabiParams).promise();
                console.log('File uploaded to Wasabi:', wasabiUploadResult.Location);
                
                // After successful upload, send the Wasabi URL to the client
                res.status(200).json({ url: wasabiUploadResult.Location });
            } catch (error) {
                console.error('Error uploading to Wasabi:', error);
                res.status(500).json({ error: error.message });
            } finally {
                // Make sure to close the read stream
                readStream.close();
                // Delete the local file after successful upload
                fs.unlink(outputPath, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            }
        })
        .on('error', (err, stdout, stderr) => {
            console.error('Error during conversion:', err.message);
            console.error('ffmpeg stderr:', stderr); // This will log the full error output from ffmpeg
        res.status(500).json({ error: err.message, ffmpegError: stderr });
        })
        .run();
}


const uploadFileToWasabi = async (file) => {
    const bucketName = 'your-bucket-name'; // Replace with your Wasabi bucket name
    const fileName = Date.now() + '-' + file.originalname;
    const fileContent = file.buffer;

    const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent,
    };

    try {
        await s3.upload(params).promise();
      return fileName; // Return the file name for further use
    } catch (error) {
        console.error('File upload error:', error);
        throw error;
    }
};
  



    

const changeFPS = (video, fpsValue, res) => {
    ffmpeg(video).fps(fpsValue).on('end', () => {
        res.status(200).json( { message: `Changed video fps to ${fpsValue} successfully`})
    })
    .on('error', (err) => {
        console.log('Error changing FPS', err)
        res.status(500).json( { message: 'Error changing FPS' + err.message } );
    }).saveToFile('changedFPS.mp4')
}

const cropVideo = (video, startTime, endTime, res) => {
    return new Promise((resolve, reject) => {
        ffmpeg(video)
        .setStartTime(startTime)
        .outputOptions(`-to ${endTime}`)
        .outputOptions('-c copy') // Remove for frame-accurate trimming at the cost of speed
        .on('end', () => {
            console.log('Trimming completed.');
            resolve('trimmedVideo.mp4');
            if (!res.headersSent) res.status(200).json({ message: 'Trimming completed.'});
        })
        .on('error', (err) => {
            console.error('Error during trimming:', err);
            reject(err);
            if (!res.headersSent) res.status(500).json({ message: err.message } )
        })
        .save('trimmedVideo.mp4');
    });
  };


const resolutionModification = (video, desiredResolution, supportedResolutions, res, req) => {
    const outputFileName = `changedVideoResolution(${desiredResolution}p).mp4`;

    if(supportedResolutions.includes(desiredResolution)){
        ffmpeg(video).videoFilter(`scale=${desiredResolution}:-1`)
        .on('end', () => {
            if (!res.headersSent) res.status(200).json({ message: 'Resolution change completed' });
            console.log('Resolution change completed');
        })
        .on('error', (err) => {
            if (!res.headersSent) res.status(500).json({ message: 'Error' + err.message } );
            console.log('Error', err);
        })
        .save(outputFileName)
    }else{
        if (!res.headersSent) res.status(400).json({ message: 'Unsupported video resolution' } );
        console.error('Unsupported video resolution');
    }
}

const extractAudioFromVideo = (video, res) => {
    ffmpeg(video).noVideo().audioCodec('libmp3lame')
    .on('end', ()=> {
        res.status(200).json({ message: 'Conversion successful' } );
    }).on('error', (err) => {
        res.status(500).json({ message: err.message } );
    }).saveToFile('extractedAudio.mp3')
}

const noiseReduction = (file ,res) => {
    ffmpeg(file).audioFilters('anlmdn')
        .on('end', ()=> {
            if(!res.headersSent) {
                res.status(200).json({ message: 'Noise Reduced Successfully' } );
                console.log('Noise reduced successfully')
            }
        }).on('error', (err)=> {
            if(!res.headersSent){
                console.log("There was an unexpected error while processing your video ", err);
                res.status(500).json({ message: 'Unexpected Error: ' + err.message } );
            }
        }).saveToFile('noiseReduced.mp3')
}


module.exports = router