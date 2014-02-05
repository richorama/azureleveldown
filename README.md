# azureleveldown

**A drop-in replacement for [LevelDOWN](https://github.com/rvagg/node-leveldown) which persists data in [Windows Azure Table Storage](http://www.windowsazure.com/en-us/documentation/articles/storage-nodejs-how-to-use-table-storage/). Can be used as a back-end for [LevelUP](https://github.com/rvagg/node-levelup) rather than an actual LevelDB store.**

As of version 0.7, LevelUP allows you to pass a `'db'` option when you create a new instance. This will override the default LevelDOWN store with a LevelDOWN API compatible object. 

## Installation

```
npm install azureleveldown levelup
```

## Example

```js
var connection = 'DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=yyy'

var levelup = require('levelup');
var LevelAzureDown = require('azureleveldown');

var db = levelup(connection, {
  // the 'db' option replaces LevelDOWN
  db: function (connection) { 
    return new LevelAzureDown(connection) 
  }
})

// An azureleveldown db works within a single table and partition. 
// These can be controlled by passing some settings into the contsuctor 


var db = levelup(connection, {
  db: function (connection) { 
    return new LevelAzureDown(connection,  {table:"table1", partitionKey: "partition1"}) 
  }
})

// reading & writing data is done using the normal 'level' way:

db.put('my_key', 'my value', function(err){ ... });

db.get('my_key', function(err, data){ 
	console.log(data.key + " = " + data.value);
});

db.del('another_key', function(err){ ... });

db.readStream()
  .on('data', console.log)
  .on('close', function () { console.log('the end') })
```

## Known Limitiations

* `reverse` read streams are not currently supported
* Only text (utf8) keys and values are supported
* The table storage limits for key and value sizes (1KB / 64KB respectively)

## Licence

MIT