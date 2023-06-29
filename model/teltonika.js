const mongoose = require("mongoose")

const schema =new mongoose.Schema({
	deviceImei: {type:String, require:true},
	lat:{type:Number, default:0},
    lng:{type:Number, default:0},
    movement:{type:Number, default:0},
    speed:{type:Number, default:0},
    fuel:{type:Number, default:0},
	battery:{type:Number, default:0},
	signal:{type:Number, default:0},
	address: {type:String},
	transferDate:{ type: Date, default: Date.now() },
	iccid: {type:String},
	ip: {type:String},
	ignition:{type:Number}
}, { timestamps: true })

module.exports = mongoose.model("Teltonika", schema)