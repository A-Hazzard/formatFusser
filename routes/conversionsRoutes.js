const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');

// const AWS = require('aws-sdk');
const multer = require('multer') //for file uploads
const path = require('path');

/* USE STORAGE IF YOU WANT TO STORE FILE ON YOUR DISK INSTEAD OF MEMORY */
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


/* USE THE STORAGE FUNCTION INSTEAD IF YOU WANT TO STORE FILE ON YOUR DISK INSTEAD OF MEMORY */
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
        case "file conversion" : convertFile(req.file.buffer, desiredFileType, res, req);
        break;

        case "fps modification" : changeFPS(req.file.buffer, fpsValue, res);
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
const convertFile = async (videoBuffer, desiredFileType, res, req) => {
    // Create a temporary directory for conversion
    const tempDirectory = path.join(os.tmpdir(), 'conversions');

    if (!fs.existsSync(tempDirectory)) {
        fs.mkdirSync(tempDirectory, { recursive: true });
    }

    // Generate temporary file paths
    const inputFilePath = path.join(tempDirectory, `${Date.now()}_input`);
    const outputFilePath = path.join(tempDirectory, `${Date.now()}_converted.${desiredFileType}`);

    // Write the uploaded file buffer to a temporary file
    fs.writeFileSync(inputFilePath, videoBuffer);

    console.log('Starting conversion process');
    ffmpeg(inputFilePath)
        .output(outputFilePath)
        .on('end', async () => {
            console.log(`File converted and available at ${outputFilePath}`);

            // Stream the file to the client
            res.setHeader('Content-Disposition', 'attachment; filename=' + path.basename(outputFilePath));
            res.setHeader('Content-Type', 'application/octet-stream');

            const readStream = fs.createReadStream(outputFilePath);

            readStream.pipe(res).on('finish', () => {
                // Clean up: Delete temporary files
                fs.unlinkSync(inputFilePath);
                fs.unlinkSync(outputFilePath);
            });
        })
        .on('error', (err) => {
            console.error('Error during conversion:', err.message);
            // Clean up even if there's an error
            fs.unlinkSync(inputFilePath);
            if (fs.existsSync(outputFilePath)) {
                fs.unlinkSync(outputFilePath);
            }
            res.status(500).json({ error: err.message });
        })
        .run();
};




 // Upload to Wasabi inside the `convertFile` function
// const convertFile = async (video, desiredFileType, res, req) => {
//     // Directory within the project, not managed by OneDrive
//     const outputDirectory = path.resolve(__dirname, './conversions');

//     // Create directory if it doesn't exist
//     if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: true });
    

//     // Generate the output file name
//     const outputFileName = `${Date.now()}_converted.${desiredFileType}`;
//     const outputPath = path.join(outputDirectory, outputFileName);

//     console.log('Converting file to', desiredFileType);
    
//     ffmpeg(video)
//         .output(outputPath)
//         .on('end', async () => {
//             console.log(`File converted and available at ${outputPath}`);
            
//             // Upload the file to Cloudinary
//             try {
//                 let result = await cloudinary.uploader.upload(outputPath, {
//                   resource_type: "auto", // Cloudinary will auto-detect the resource type (image/video/audio)
//                   public_id: "conversions/" + path.basename(outputPath, `.${desiredFileType}`) // Optional: specify a public ID for the file
//                 });
                
//                 console.log('File uploaded to Cloudinary:', result.secure_url);
                
//                 // After successful upload, send the Cloudinary URL to the client
//                 res.status(200).json({ url: result.secure_url });
//             } catch (error) {
//                 console.error('Error uploading to Cloudinary:', error);
//                 res.status(500).json({ error: error.message });
//             } finally {
//                 // Delete the local file after successful upload
//                 fs.unlink(outputPath, (err) => {
//                     if (err) console.error('Error deleting file:', err);
//                 });
//             }
//         })
//         .on('error', (err) => {
//             console.error('Error during conversion:', err.message);
//             res.status(500).json({ error: err.message });
//         })
//         .run();
// }

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