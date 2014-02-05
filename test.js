var connection = 'DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=yyy'
var levelup = require('levelup');
var LevelAzureDown = require('./index');

var db = levelup(connection, {
  // the 'db' option replaces LevelDOWN
  db: function (connection) { return new LevelAzureDown(connection, {table:"tablex", partitionKey: "partition2"}) }
})

db.put('foo', 'bar', function (err) {
  if (err) throw err
  db.get('foo', function (err, value) {
    if (err) throw err
    console.log('Got foo =', value)
})


var stream = db.readStream({keys:true, values:true});
stream.on('data', function(data){
	console.log(data);
})
stream.on('end', function(){
	console.log("end");
})