"use strict";

Entry.Roborobo_Roduino = {
    name: 'roborobo_roduino',
    INSTRUCTION : {
        DIGITAL_READ: 1,
        DIGITAL_SET_MODE: 2,
        DIGITAL_WRITE: 3,
        ANALOG_WRITE: 4,
        ANALOG_READ: 5,
        MOTOR: 6,
        COLOR: 7
    },
    setZero: function() {        
        Entry.hw.sendQueue.colorPin = 0;
        Entry.hw.sendQueue.analogEnable = [ 0, 0, 0, 0, 0, 0 ];
        for (var port = 0; port < 14; port++) {
            Entry.hw.sendQueue[port] = 0;
        }
        this.ColorPin = [ 0, 0, 0 ];
        Entry.hw.update();
    },
    ColorPin: [ 0, 0, 0 ]
};

Entry.Roborobo_SchoolKit = {
    name: 'roborobo_schoolkit',
    pinMode : {
        INPUT:  0,
        OUTPUT: 1,
        ANALOG: 2,
        PWM:    3,
        SERVO:  4
    },
	inputPort : {
		ir : 7,
		sound : 8,
		contact : 9,
		cds : 10
	},
    setZero: function() {
        Entry.hw.sendQueue.initHW_Flag = true;
        Entry.hw.update();
        
        Entry.hw.sendQueue.digitalPinMode = [];
        Entry.hw.sendQueue.servo = [ false, false, false, false, false ];
        for (var port = 0; port < 14; port++) {
            Entry.hw.sendQueue[port] = 0;
			Entry.hw.sendQueue.digitalPinMode[port] = 0;
        }
        Entry.hw.update();
        
        Entry.hw.sendQueue.initHW_Flag = false;
        Entry.hw.update();
    }
};

// Roduino
Blockly.Blocks.roduino_on_block = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_on);
        this.setOutput(true, 'Number');
        this.setInputsInline(true);
    }
}

Entry.block.roduino_on_block = function (sprite, script) {
    return "1";
};

Blockly.Blocks.roduino_off_block = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_off);        
        this.setOutput(true, 'Number');
        this.setInputsInline(true);
    }
}

Entry.block.roduino_off_block = function (sprite, script) {
    return "0";
};

Blockly.Blocks.roduino_get_analog_number = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          [ '0', "0" ],
          [ '1', "1" ],
          [ '2', "2" ],
          [ '3', "3" ],
          [ '4', "4" ],
          [ '5', "5" ]
          ]), "PORT");
    this.appendDummyInput().appendField(' ');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);
  }
};

Entry.block.roduino_get_analog_number = function (sprite, script) {
    return script.getStringField("PORT");
};

Blockly.Blocks.roduino_get_port_number = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          ['2',"2"],
          ['3',"3"],
          ['4',"4"],
          ['5',"5"],
          ['6',"6"],
          ['7',"7"],
          ['8',"8"]
          ]), "PORT");
    this.appendDummyInput().appendField(' ');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);    
  }
};

Entry.block.roduino_get_port_number = function (sprite, script) {
    return script.getStringField("PORT");
};

Blockly.Blocks.roduino_get_analog_value = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_analog_value_1);
    this.appendValueInput("VALUE")
        .setCheck(["Number", "String", null]);
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_analog_value_2)
        .appendField(" ");
    this.setInputsInline(true);
    this.setOutput(true, 'Number');
  }
};

Entry.block.roduino_get_analog_value = function (sprite, script) {
    var signal = parseInt(script.getValue("VALUE", script));
    Entry.hw.sendQueue[0] = Entry.Roborobo_Roduino.INSTRUCTION.ANALOG_READ;
    Entry.hw.sendQueue.analogEnable[signal] = 1;
    Entry.hw.update();
    return Entry.hw.getAnalogPortValue(signal);
};

Blockly.Blocks.roduino_get_digital_value = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_get_digital_value_1);
    this.appendValueInput("VALUE")
        .setCheck("Number");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_sensor_value_2)
        .appendField(" ");
    this.setInputsInline(true);
    this.setOutput(true, 'Number');
  }
};

Entry.block.roduino_get_digital_value = function (sprite, script) {
    var signal = script.getNumberValue("VALUE");
    Entry.hw.sendQueue[0] = Entry.Roborobo_Roduino.INSTRUCTION.DIGITAL_READ;
    Entry.hw.sendQueue[1] = signal;
    return Entry.hw.getDigitalPortValue(signal - 2);    
};

Blockly.Blocks.roduino_get_color = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_color + " ")
        .appendField(new Blockly.FieldDropdown([
                [Lang.Blocks.roborobo_color_red, "red"],
                [Lang.Blocks.roborobo_color_green, "green"],
                [Lang.Blocks.roborobo_color_blue, "blue"],
                [Lang.Blocks.roborobo_color_yellow, "yellow"]
            ]), "VALUE")
        .appendField(Lang.Blocks.roborobo_color_detected);
        this.setInputsInline(true);
        this.setOutput(true, 'Number');
    }
};

Entry.block.roduino_get_color = function (sprite, script) {
    var flag = 0;
    var signal = script.getField("VALUE", script);
    var value =
    [
        Entry.hw.portData[Entry.Roborobo_Roduino.ColorPin[0] - 2],
        Entry.hw.portData[Entry.Roborobo_Roduino.ColorPin[1] - 2],
        Entry.hw.portData[Entry.Roborobo_Roduino.ColorPin[2] - 2]
    ];
    
    switch(signal) {
        case "red":
            if(value[0] == 1 && value[1] == 0 && value[2] == 0) {
                flag = 1;
            }
        break;
        case "green":
            if(value[0] == 0 && value[1] == 1 && value[2] == 0) {
                flag = 1;
            }
        break;
        case "blue":
            if(value[0] == 0 && value[1] == 0 && value[2] == 1) {
                flag = 1;
            }
        break;
        case "yellow":
            if(value[0] == 1 && value[1] == 1 && value[2] == 1) {
                flag = 1;
            }
        break;
    }
    return flag;
};

Blockly.Blocks.roduino_set_digital = {
  init: function() {    
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_pin_1);
    this.appendValueInput("VALUE")
        .setCheck(["Number", "String", null]);
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_pin_2);
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          [Lang.Blocks.roborobo_on,"on"],
          [Lang.Blocks.roborobo_off,"off"]
          ]), "OPERATOR")
        .appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
  }
};

Entry.block.roduino_set_digital = function (sprite, script) {
    var pin = script.getNumberValue("VALUE");
    var operator = script.getField("OPERATOR");
    var value = operator == "on" ? 1 : 0;
    Entry.hw.sendQueue[0] = Entry.Roborobo_Roduino.INSTRUCTION.DIGITAL_WRITE;
    Entry.hw.sendQueue[1] = pin;
    Entry.hw.update();
    Entry.hw.setDigitalPortValue(pin, value);
    return script.callReturn();
};

Blockly.Blocks.roduino_motor = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            [Lang.Blocks.roborobo_motor1, "motor1"],
            [Lang.Blocks.roborobo_motor2, "motor2"]
            ]), "MODE");
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            [Lang.Blocks.roborobo_motor_CW, "cw"],
            [Lang.Blocks.roborobo_motor_CCW, "ccw"],
            [Lang.Blocks.roborobo_motor_stop, "stop"]
            ]), "OPERATOR")
        .appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};

Entry.block.roduino_motor = function (sprite, script) {
    var pin1 = pin2 = 0;
    var value1 = value2 = 0;
    var mode = script.getField("MODE");
    var operator = script.getField("OPERATOR");
    
    if(mode == "motor1") {
        pin1 = 9;
        pin2 = 10;
    } else {
        pin1 = 11;
        pin2 = 12;
    }
    
    if (operator == "cw") {
        value1 = 1;
        value2 = 0;
    } else if (operator == "ccw") {
        value1 = 0;
        value2 = 1;
    } else {
        value1 = 0;
        value2 = 0;
    }
    Entry.hw.setDigitalPortValue(pin1, value1);
    Entry.hw.setDigitalPortValue(pin2, value2);
    return script.callReturn();
};

Blockly.Blocks.roduino_set_color_pin = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_color + "R : ");
        this.appendValueInput("RED").setCheck(["Number", "String", null]);
        
        this.appendDummyInput().appendField(" G : ");
        this.appendValueInput("GREEN").setCheck(["Number", "String", null]);
        
        this.appendDummyInput().appendField(" B : ");
        this.appendValueInput("BLUE").setCheck(["Number", "String", null]);
        
        this.appendDummyInput().appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
        
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};

Entry.block.roduino_set_color_pin = function (sprite, script) {
    var redPin = script.getNumberValue("RED", script);
    var greenPin = script.getNumberValue("GREEN", script);
    var bluePin = script.getNumberValue("BLUE", script);
    
    Entry.Roborobo_Roduino.ColorPin = [ redPin, greenPin, bluePin ];
    Entry.hw.sendQueue[0] = Entry.Roborobo_Roduino.INSTRUCTION.COLOR;
    Entry.hw.sendQueue.colorPin = redPin;
    Entry.hw.update();
    return script.callReturn();
};

// SchoolKit
Blockly.Blocks.schoolkit_on_block = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_on);        
        this.setOutput(true, 'Number');
        this.setInputsInline(true);
    }
}

Entry.block.schoolkit_on_block = function (sprite, script) {
    return "1";
};

Blockly.Blocks.schoolkit_off_block = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_off);        
        this.setOutput(true, 'Number');
        this.setInputsInline(true);
    }
}

Entry.block.schoolkit_off_block = function (sprite, script) {
    return "0";
};

Blockly.Blocks.schoolkit_get_out_port_number = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          [ "OUT1", '2' ],
          [ "OUT2", '3' ],
          [ "OUT3", '4' ],
          [ "OUT4", '5' ],
          [ "OUT5", '6' ]
          ]), "PORT");
    this.appendDummyInput().appendField(' ');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);
  }
};

Entry.block.schoolkit_get_out_port_number = function (sprite, script) {
    return script.getNumberField("PORT");
};

Blockly.Blocks.schoolkit_set_output = {
  init: function() {    
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_pin_1);
    this.appendValueInput("VALUE")
        .setCheck(["Number", "String", null]);
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_pin_2);
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          [Lang.Blocks.roborobo_on,"on"],
          [Lang.Blocks.roborobo_off,"off"]
          ]), "OPERATOR")
        .appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
  }
};

Entry.block.schoolkit_set_output = function (sprite, script) {
    var pin = script.getNumberValue("VALUE");
    var operator = script.getField("OPERATOR");
    var value = operator == "on" ? 1 : 0;
    
    Entry.hw.sendQueue.digitalPinMode[pin] = Entry.Roborobo_SchoolKit.pinMode.OUTPUT;
    Entry.hw.sendQueue[pin] = value;
    return script.callReturn();
};

Blockly.Blocks.schoolkit_get_in_port_number = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          [ "IN1", '7' ],
          [ "IN2", '8' ],
          [ "IN3", '9' ],
          [ "IN4", '10' ],
          [ "IN5", '11' ],
          [ "IN6", '12' ],
          [ "IN7", '13' ]
          ]), "PORT");
    this.appendDummyInput().appendField(' ');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);
  }
};

Entry.block.schoolkit_get_in_port_number = function (sprite, script) {
    return script.getNumberField("PORT");
};

Blockly.Blocks.schoolkit_get_input_value = {
  init: function() {
    this.setColour("#00979D");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_get_digital_value_1);
    this.appendValueInput("VALUE")
        .setCheck("Number");
    this.appendDummyInput()
        .appendField(Lang.Blocks.roborobo_num_sensor_value_2)
        .appendField(" ");
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
  }
};

Entry.block.schoolkit_get_input_value = function (sprite, script) {
    var signal = script.getNumberValue("VALUE");
    Entry.hw.sendQueue.digitalPinMode[signal] = Entry.Roborobo_SchoolKit.pinMode.INPUT;
    Entry.hw.update();
    return Entry.hw.portData[signal - 7];
};

Blockly.Blocks.schoolkit_motor = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            [Lang.Blocks.roborobo_motor1, "motor1"],
            [Lang.Blocks.roborobo_motor2, "motor2"]
            ]), "MODE");
        this.appendValueInput("VALUE").setCheck(["Number", "String", null]);
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            [Lang.Blocks.roborobo_motor_CW, "cw"],
            [Lang.Blocks.roborobo_motor_CCW, "ccw"],
            [Lang.Blocks.roborobo_motor_stop, "stop"]
            ]), "OPERATOR")
            .appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};

Entry.block.schoolkit_motor = function (sprite, script) {
    var mode = script.getField("MODE");
    var pin = 0;
    var operator = script.getField("OPERATOR");
    var value = script.getNumberValue("VALUE");
    
    if(mode == "motor1") {
        pin = 7;        
    } else {
        pin = 8;
    }
    
    if(value > 255) {
        value = 255;
    } else if(value < 0) {
        value = 0;
    }
    
    Entry.hw.sendQueue.digitalPinMode[pin] = Entry.Roborobo_SchoolKit.pinMode.PWM;
    Entry.hw.sendQueue.digitalPinMode[pin - 7] = Entry.Roborobo_SchoolKit.pinMode.PWM;
    
    if (operator == "cw") {
        Entry.hw.sendQueue[pin] = value;
        Entry.hw.sendQueue[pin - 7] = 0x00;
    } else if (operator == "ccw") {
        Entry.hw.sendQueue[pin] = 0x00;
        Entry.hw.sendQueue[pin - 7] = value;
    } else if(operator == "stop") {
        Entry.hw.sendQueue[pin] = 0x00;
        Entry.hw.sendQueue[pin - 7] = 0x00;
    }
    
    return script.callReturn();
};

Blockly.Blocks.schoolkit_set_servo_value = {
    init: function() {
        this.setColour("#00979D");
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_num_pin_1);
        this.appendValueInput("PIN").setCheck(["Number", "String", null]);
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_num_pin_2);
        this.appendDummyInput().appendField(" : ");
        this.appendValueInput("VALUE").setCheck(["Number", "String", null]);
        this.appendDummyInput().appendField(Lang.Blocks.roborobo_degree);
        this.appendDummyInput().appendField(new Blockly.FieldIcon(Entry.mediaFilePath + 'block_icon/hardware_03.png', '*'));
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};

Entry.block.schoolkit_set_servo_value = function (sprite, script) {
    var pin = script.getNumberValue("PIN");
    var value = script.getNumberValue("VALUE");
    
    Entry.hw.sendQueue.digitalPinMode[pin] = Entry.Roborobo_SchoolKit.pinMode.PWM;

    if(value < 0) {
        value = 0;
    } else if(value > 180) {
        value = 180;
    }
    Entry.hw.sendQueue.servo[pin - 2] = true;
    Entry.hw.sendQueue[pin] = value;
    return script.callReturn();
};
