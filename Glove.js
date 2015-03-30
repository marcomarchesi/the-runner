/* Glove.js
* by Marco Marchesi
*/
var chalk = require('chalk');
var fs = require('fs');
var _ = require('underscore');
var io = require('socket.io');

// Serial port
var serialport = require("serialport").SerialPort;

// UNCOMMENT FOR Neural Network
// var brain = require('brain');
// var net = new brain.NeuralNetwork();

// UNCOMMENT FOR Leap Motion
// var Leap = require('leapjs');
// var controller = new Leap.Controller({enableGestures: false});
// var leapHand = {};


// serial port parameters
var BT_PORT = "/dev/cu.AmpedUp-AMP-SPP";
var USB_PORT = "/dev/tty.usbserial-DA00RAK6";
var START_CMD = [0x01,0x02,0x01,0x03];
var STOP_CMD = [0x01,0x02,0x00,0x03];
var BAUD_RATE = 115200;
// imu parameters
var G_FACTOR = 0.00390625;
var GYRO_FACTOR = 14.375;
var ACC_X_OFFSET = -17.948;
var ACC_Y_OFFSET = -12.820;
var ACC_Z_OFFSET = 38.46;
var GYR_X_OFFSET = -0.63;
var GYR_Y_OFFSET = 1.81;
var GYR_Z_OFFSET = 0.07;
var SAMPLE_TIME = 0.03 // 30 milliseconds
var pitch = roll = yaw = 0;

var stepCount = 0;

/* not sure yet on COMPASS values */
var COM_X_OFFSET = 27.5;
var COM_Y_OFFSET = 38;
var COM_Z_OFFSET = -25;
var COM_X_SCALE = 0.97;
var COM_Y_SCALE = 0.97;
var COM_Z_SCALE = 1.05;
/*************************/

var ALPHA = 0.97; //from ALPHA = t / (SAMPLE_TIME * t) and t = 1 (initial guess)
var com_x_offset = 0;
var com_y_offset = 0;
var com_z_offset = 0;

var SAMPLE_DIM = 6;
var DECIMAL_PRECISION = 4;

// var com_x_max = com_y_max = com_z_max = 0;
// var com_x_min = com_y_min = com_z_min = 0;

var buffer = new Buffer(21);
var byteCounter =0;
// var isTracking = false;
var hand_data = "";
var imuBuffer = {};
var sampleCounter = 0;

var io = require('socket.io').listen(8001);

console.log("Hello Glove!");

// var quaternion = require("./Quaternion.js");
// var q = new quaternion(0.4,10);

// var Recognizer = require("./GestureRecognizer.js");
// var recognizer = new Recognizer();

// /* init trained neural network */
// var network = JSON.parse(fs.readFileSync('./trained_net.json','utf-8'));
// net.fromJSON(network);

var sp = new serialport(BT_PORT, {
  baudrate: BAUD_RATE,
  rtscts: false,
  flowControl: false
});

    /* OPEN SERIAL PORT */
    /********************/
    sp.on("open", function () {
        console.log('Serial port is open');
        sp.write(START_CMD);
    });

    sp.on('data',function(data){ 
          for(var i = 0;i<data.length;++i){
            buffer[byteCounter] = data[i]; 
            byteCounter++;
          }
          if(byteCounter==21)
            sendData();

    });
    sp.on('error',function(error){
      console.log(chalk.red(error));
    });
  
    /* uncomment for LEAP MOTION usage */
    // controller.loop(function(frame) {

    //         for (var i in frame.handsMap) {
    //           leapHand = frame.handsMap[i];
    //           // console.log(leapHand.roll());
    //           io.sockets.emit('data',{roll:leapHand.roll(),pitch:leapHand.pitch(),yaw:leapHand.yaw()});
    //         }
            
    // });
    // controller.on('ready', function() {
    //       console.log(chalk.green("Leap Motion ready"));
    // });

    /* *********************** */


function sendData(){

      var acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z,com_x,com_y,com_z;

      // if(com_x_offset == 0)
      //   com_x_offset = com_x;

      // if(com_y_offset == 0)
      //   com_y_offset = com_y;

      // if(com_z_offset == 0)
      //   com_z_offset = com_z;

      acc_x = (buffer.readInt16LE(2) + ACC_X_OFFSET)*G_FACTOR;
      acc_y = (buffer.readInt16LE(4) + ACC_Y_OFFSET)*G_FACTOR;
      acc_z = (buffer.readInt16LE(6) + ACC_Z_OFFSET)*G_FACTOR;
      gyr_x = buffer.readInt16LE(8)/GYRO_FACTOR + GYR_X_OFFSET;
      gyr_y = buffer.readInt16LE(10)/GYRO_FACTOR + GYR_Y_OFFSET;
      gyr_z = buffer.readInt16LE(12)/GYRO_FACTOR + GYR_Z_OFFSET;
      com_x = COM_X_SCALE * (buffer.readInt16LE(14) - COM_X_OFFSET);
      com_y = COM_Y_SCALE * (buffer.readInt16LE(16) - COM_Y_OFFSET);
      com_z = COM_Z_SCALE * (buffer.readInt16LE(18) - COM_Z_OFFSET);


      /* VALUES FOR COMPASS CALIBRATION */
      // com_x_max = Math.max(com_x_max,com_x);
      // com_x_min = Math.min(com_x_min,com_x);
      // com_y_max = Math.max(com_y_max,com_y);
      // com_y_min = Math.min(com_y_min,com_y);
      // com_z_max = Math.max(com_z_max,com_z);
      // com_z_min = Math.min(com_z_min,com_z);

      // console.log(chalk.yellow("acc_x " + acc_x.toFixed(2) + " acc_y " + acc_y.toFixed(2) + " acc_z " + acc_z.toFixed(2)));
      // console.log(chalk.yellow("gyr_x " + gyr_x.toFixed(2) + " gyr_y " + gyr_y.toFixed(2) + " gyr_z " + gyr_z.toFixed(2)));
      // console.log(chalk.yellow("com_x " + com_x + " com_y " + com_y + " com_z " + com_z));

      var length = Math.sqrt(acc_x * acc_x+ acc_y  * acc_y  +acc_z  * acc_z );
      if(length>=1.85){
         stepCount = 1;
      }else
        stepCount = 0;

      


      /* IMUfilter NOT WORKING */
      // q.update(acc_x,acc_y,acc_z,degreesToRadians(GYR_X_OFFSET),degreesToRadians(gyr_y),degreesToRadians(gyr_z));
      // q.computeEuler();
      // roll = q.getRoll();
      // pitch = q.getPitch();
      // yaw = q.getYaw();

      /* COMPLEMENTARY FILTER */
      /* it works with the accelerometer and the gyroscope */
      //IMU is rotated of -Math.PI/2 so I swap x & y in the formulas below:

      /* ROLL */
      var roll_short = Math.atan2(acc_x,Math.sqrt(acc_y*acc_y + acc_z*acc_z));
      roll = ALPHA * (roll - (degreesToRadians(gyr_y) * SAMPLE_TIME)) + (1- ALPHA) * roll_short;
      /* PITCH */
      var pitch_short  = Math.atan2(acc_y,acc_z);
      pitch  = ALPHA * (pitch + (degreesToRadians(gyr_x) * SAMPLE_TIME)) + (1- ALPHA) * pitch_short;
      // var yaw_short = degreesToRadians(com_y);
      // yaw = ALPHA * (yaw + (degreesToRadians(gyr_z) * SAMPLE_TIME)) + (1- ALPHA) * yaw_short;
      var yaw_compensation = sign(yaw)*degreesToRadians(SAMPLE_TIME*0.144);
      var yaw_old = yaw;
      yaw = yaw + (degreesToRadians(gyr_z) * SAMPLE_TIME) + yaw_compensation;
      // yaw = 0;

      // if(sign(yaw_old) != sign(yaw))
      //   stepCount = 1;
      // else
      //   stepCount = 0;
      console.log(yaw);


      
      imuBuffer = [ acc_x.toFixed(DECIMAL_PRECISION),
                    acc_y.toFixed(DECIMAL_PRECISION),
                    acc_z.toFixed(DECIMAL_PRECISION),
                    gyr_x.toFixed(DECIMAL_PRECISION),
                    gyr_y.toFixed(DECIMAL_PRECISION),
                    gyr_z.toFixed(DECIMAL_PRECISION),
                    com_x.toFixed(DECIMAL_PRECISION),
                    com_y.toFixed(DECIMAL_PRECISION),
                    com_z.toFixed(DECIMAL_PRECISION)
                    ];

      // send data to client
        sampleCounter++;


        // //update queue with a new value
        // var queueElement = [];
        // for(var i = 0;i<recognizer.GESTURE_SAMPLES;++i){
        //   queueElement.push(Number(imuBuffer[i]));
        // }
        // recognizer.queue.push(queueElement);

        // if(recognizer.queue.length == recognizer.GESTURE_SAMPLES+1)
        //   recognizer.queue.shift();

        // var flattenQueue = _.flatten(recognizer.queue,true);

        // // detect new gesture from updated data
        // var output = recognizer.run(net,flattenQueue);
        //   // console.log("circle is " + output.circle);
        //   // console.log("stop is " + output.stop);
        //   // console.log("walking is " + output.walking);
        //   // console.log("start mic is " + output.mic);

        for(var i=0;i<SAMPLE_DIM-1;++i)
          hand_data += imuBuffer[i] + '\t';

        hand_data += imuBuffer[SAMPLE_DIM-1] + '\n';

        io.sockets.emit('data',{roll:roll,pitch:pitch,yaw:yaw,stepCount:stepCount,counter:sampleCounter,raw:imuBuffer});
        // if(sampleCounter == 60)
        //   sampleCounter = 0;
    // }
    buffer = new Buffer(21);
    byteCounter = 0;
    // sp.write(READ_CMD);
}

function degreesToRadians(degree){
  return degree*(Math.PI/180);
}
function sign(value){
  if (value > 0)
    return 1;
  else
    return -1;
}


io.sockets.on('connection', function (socket) {
  // start tracking
  socket.on('start',function (data) {
    hand_data = "";
    sampleCounter = 0;
  });
  socket.on('stop',function(data) {
    onStop(data.gesture);
  });
});


/* onStop()
*/
function onStop(gesture){
    // isTracking = false;

        /* valid gestures:
    * 1. start mic
    * 2. stop
    * 3. walking 
    * 4. circle 
    */

    var gestureCSV = "";
    var gestureString = "************TIME_SERIES************\n";
    gestureString += "ClassID: " + gesture + "\n";
    gestureString += "TimeSeriesLength: " + sampleCounter + "\n";
    gestureString += "TimeSeriesData: \n";
    var filepath = './training_set/TrainingData.txt';
    var csv_path = './training_set/TrainingData.csv';


    // save txt format for GRT

    var data = fs.readFileSync(filepath,'utf-8');
    data += gestureString + hand_data;
    fs.writeFile(filepath, data, function (err) {
       if (err) console.log("Error: ", err);
      console.log('It\'s saved!');
    });

    // save csv format for Matlab

    // var csv_data = fs.readFileSync(csv_path,'utf-8');
    // csv_data += gestureCSV + hand_data;
    // fs.writeFile(csv_path, csv_data, function (err) {
    //    if (err) console.log("Error: ", err);
    //   console.log('It\'s saved!');
    // });


    // reset
    sampleCounter = 0;

}
