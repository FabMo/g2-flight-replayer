var fs = require('fs');
var serialport = require('serialport');
var jsesc = require('jsesc');
var argv = require('minimist')(process.argv.slice(2));

var CONTROL_PATH = '/dev/cu.usbmodem1421';
var DATA_PATH = '/dev/ttyACM1';
var FLIGHT_RECORD_PATH = '/opt/fabmo/log/g2-flight-log.json';
var single_port_override = true;
var control_token = 'C';
var data_token = 'D';
var control_buffer = [];
var data_buffer = [];

//control_port = new serialport.SerialPort(CONTROL_PATH, {rtscts:true}, false);
//data_port = new serialport.SerialPort(DATA_PATH, {rtscts:true}, false);

function loadFlightRecord(filename, callback) {
  fs.readFile(filename, function(err, data) {
    if(err) { return callback(err); }
    flightData = JSON.parse(data);
    callback(null, flightData);
  });
}


var onControlData = function(data) {
	var s = data.toString('utf8');
	var len = s.length;
	for(var i=0; i<len; i++) {
		c = s[i];
		if(c === '\n') {
			console.log(' <---------------' + control_token + '-- ' + control_buffer.join(''));
			control_buffer = [];
		} else {
			control_buffer.push(c);
		}
	}
};

function connect(callback) {
  console.log("Opening port")
  control_port.open(function(err) {
    console.log(err)
    if(err) { return callback(err); }
    control_port.on('data', onControlData);

    if(this.control_port !== this.gcode_port && !single_port_override) {
      data_port.open(function(err) {
        if(err) { return callback(err); }
        callback();
      });
    } else {
      gcode_port = control_port;
      control_token = data_token = 'S';
      callback();
    }
  });
}

function replay(records, options, callback) {
  var startTime = new Date().getTime();
  if(records.length == 0) {
    return callback();
  }

  if(records[0].ch == 'S') {
    single_port_override = true;
  }

  function consume(records) {
    if(records.length === 0) {
      return callback();
    }

    var record = records[0];
    if(record.dir === 'out') {
      var currentTime = new Date().getTime() - startTime;
      var recordTime = record.t;
      var timeLeft = recordTime - currentTime;

      // Manage skip interval
      var skipTime = 0;
      if(options.skip_start || options.skip_end) {
        if(recordTime >= options.skip_start && recordTime <= options.skip_end) {
          console.log("Skip");
          records.shift();
          setImmediate(consume, records)
        }
        if(recordTime > options.skip_end) {
          skipTime = options.skip_end - options.skip_start;
        }
      }
      // If we're passed the skipped time, lop off times
      timeLeft = timeLeft - skipTime;

      // Sleep until it's time to execute this record
      if(timeLeft >= 0) {
        setTimeout(consume, timeLeft, records);
      } else {
        // Consume the record
        records.shift()

        // Decode the data payload
        var data = record.data; /*new Buffer(record.data, 'base64').toString('utf8');*/
        var timestamp = recordTime + '';

        while(timestamp.length < 8) {
          timestamp = '0' + timestamp
        }
        // Write it to the appropriate channel
        switch(record.ch) {
          case 'C':
          case 'S':
            console.log(' --- ' + timestamp + ' ---' + control_token + '-> ' + jsesc(data));
            control_port.write(data);
            break;
          case 'D':
            console.log(' --- ' + timestamp + ' ---' + data_token + '-> ' + jsesc(data));
            data_port.write(data);
            break;
          default:
            console.error("Unknown channel in flight data: " + record.ch);
            break;
        }
        setImmediate(consume, records);
      }
    } else {
      records.shift();
      setImmediate(consume, records);
    }
  }
  consume(records);
}

/*
 * MAIN
 */

 if(!('control' in argv)) {
   console.log("Usage: node main.js --control=path [--data=path] filename.json")
   console.log("   Arguments");
   console.log("     --control Path to control port (or only port if single port system), or name of COM port on Windows." )
   console.log("     --data Path to data port, or name of COM port on windows.  May be omitted if single port." )
   process.exit()
 }

CONTROL_PATH = argv['control']
DATA_PATH = argv['data']

var control_port = new serialport.SerialPort(CONTROL_PATH, {rtscts:true}, false);
var data_port = DATA_PATH ? new serialport.SerialPort(DATA_PATH, {rtscts:true}, false) : null;

var skip_time = argv['skip']
var options = {};

if(skip_time) {
    var times = skip_time.split(":")
    options.skip_start = times[0];
    options.skip_end = times[1];
}

loadFlightRecord(argv._[0], function(err, flightData) {
  if(err) { return console.error(err); }
  connect(function(err, data) {
      replay(flightData.records, options, function() {
        console.log("Replay complete.")
        process.exit();
      })
  });
});
