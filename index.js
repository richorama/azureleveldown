var util = require('util');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var AbstractIterator = require('abstract-leveldown').AbstractIterator;
var setImmediate = global.setImmediate || process.nextTick;
var bops = require('bops');
var azure = require('azure');
var noop = function(){};


function AzureIterator (db, options) {
  AbstractIterator.call(this, db)
  this._reverse = options.reverse
  this._limit   = options.limit
  this._count   = 0
  this._end     = options.end
  this._start   = options.start
  this._gt      = options.gt
  this._gte     = options.gte
  this._lt      = options.lt
  this._lte     = options.lte

  this.query = azure.TableQuery.select().from(db.config.table).where("PartitionKey eq ?", db.config.partitionKey);
  if (this._limit > 0){
    this.query = this.query.top(this._limit);
  }
  if (this._start){
    this.query = this.query.and("RowKey ge ?", this._start);
  }
  if (this._end){
    this.query = this.query.and("RowKey le ?", this._end);
  }
  if (this._reverse){
    throw new Error("Reverse is not supported");
  }
  this.index = 0;
}

util.inherits(AzureIterator, AbstractIterator)

AzureIterator.prototype._next = function (callback) {
  var self = this;
  var returnResult = function(){
    if (self.index < self.results.length){
      var entity = self.results[self.index];
      self.index = self.index + 1;
      setImmediate(function () { callback(null, entity.RowKey, entity.value) })      
    } else {
      nextPage();
    }
  }

  var pageCallback = function(err, data, meta){
    if (err || data === null || data.length === 0) {
      callback(err);
      return;
    }
    self.continuationToken = meta.continuationToken;
    self.results = data;
    self.index = 0;
    returnResult();
  }

  var nextPage = function(){
    if (self.continuationToken){
      self.continuationToken.getNextPage(pageCallback)
    } else {
      setImmediate(callback);
    }
  }

  if (self.results){
    returnResult();
    return;
  } else {
    self.db.tableService.queryEntities(self.query, pageCallback);
  }

}


// location is a connection string
function AzureDown (location, settingsOverride) {
  if (!(this instanceof AzureDown)){
    return new AzureDown(location);
  }

  if (!location){
    throw new Error("constructor requires at least a location argument");
  }

  this.tableService = azure.createTableService(location);

  var settings = {
    table: "azureleveldown",
    partitionKey: "partition1"
  }

  if (!settingsOverride){
    settingsOverride = {};
  }

  for (var key in settings){
    settings[key] = settingsOverride[key] || settings[key];
  }

  this.config = settings;

  AbstractLevelDOWN.call(this, typeof location == 'string' ? location : '')
}

util.inherits(AzureDown, AbstractLevelDOWN)

AzureDown.prototype._open = function (options, callback) {
  var self = this
  this.tableService.createTableIfNotExists(this.config.table, options, function(err){
    if (callback){
      callback(err, self);
    }
  });
}

AzureDown.prototype._put = function (key, value, options, callback) {
  var entity = {
    PartitionKey: this.config.partitionKey,
    RowKey: key,
    value: value
  }
  if (options.createIfMissing){
    this.tableService.insertOrReplaceEntity(this.config.table, entity, options, callback);  
  } else {
    this.tableService.updateEntity(this.config.table, entity, options, callback);  
  }
  
}

AzureDown.prototype._get = function (key, options, callback) {
  this.tableService.queryEntity(this.config.table, this.config.partitionKey, key, options, function(err, data){
    if (data === null || data.value === null){
      callback(new Error('NotFound'));
    } else {
      callback(err, data.value);
    }
  });
}

AzureDown.prototype._del = function (key, options, callback) {
  var entity = {
    PartitionKey: this.config.partitionKey,
    RowKey: key
  }
  this.tableService.deleteEntity(this.config.table, entity, options, callback);
}

// TODO, rewrite this to work with azure batch
AzureDown.prototype._batch = function (array, options, callback) {
  var err
    , key
    , value

  this.tableService.beginBatch();

  if (Array.isArray(array)) {
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        key = bops.is(array[i].key) ? array[i].key : String(array[i].key)
        err = this._checkKeyValue(key, 'key')
        if (err) return setImmediate(function () { callback(err) })
        if (array[i].type === 'del') {
          // todo, we should be 
          this._del(array[i].key, options, noop)
        } else if (array[i].type === 'put') {
          value = bops.is(array[i].value) ? array[i].value : String(array[i].value)
          err = this._checkKeyValue(value, 'value')
          if (err) return setImmediate(function () { callback(err) })

          var entity = {
            PartitionKey: this.config.partitionKey,
            RowKey: array[i].key,
            value: value
          }
          this.tableService.insertEntity(this.config.table, entity);
        }
      }
    }
  }
  this.tableService.commitBatch(callback);
}

AzureDown.prototype._iterator = function (options) {
  return new AzureIterator(this, options)
}

AzureDown.prototype._isBuffer = function (obj) {
  return bops.is(obj)
}

module.exports = AzureDown
