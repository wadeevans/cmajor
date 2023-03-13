//  //
//  //     ,ad888ba,                                88
//  //    d8"'    "8b
//  //   d8            88,dPba,,adPba,   ,adPPYba,  88      The Cmajor Language
//  //   88            88P'  "88"   "8a        '88  88
//  //   Y8,           88     88     88  ,adPPPP88  88      (c)2022 Sound Stacks Ltd
//  //    Y8a.   .a8P  88     88     88  88,   ,88  88      https://cmajor.dev
//  //     '"Y888Y"'   88     88     88  '"8bbP"Y8  88
//  //                                             ,88
//  //                                           888P"

import { EventListenerList } from "./cmaj-event-listener-list.js"

//==============================================================================
/// This class implements the API and much of the logic for communicating with
/// an instance of a patch that is running.
export class PatchConnection  extends EventListenerList
{
    constructor()
    {
        super();
    }

    //==============================================================================
    // Status-handling methods:

    /// Calling this will trigger an asynchronous callback to any status listeners with the
    /// patch's current state. Use addStatusListener() to attach a listener to receive it.
    requestStatusUpdate()                             { this.sendMessageToServer ({ type: "req_status" }); }

    /// Attaches a listener function that will be called whenever the patch's status changes.
    /// The function will be called with a parameter object containing many properties describing the status,
    /// including whether the patch is loaded, any errors, endpoint descriptions, its manifest, etc.
    addStatusListener (listener)                      { this.addEventListener    ("status", listener); }
    /// Removes a listener that was previously added with addStatusListener()
    removeStatusListener (listener)                   { this.removeEventListener ("status", listener); }

    /// Causes the patch to be reset to its "just loaded" state.
    resetToInitialState()                             { this.sendMessageToServer ({ type: "req_reset" }); }

    //==============================================================================
    // Methods for sending data to input endpoints:

    /// Sends a value to one of the patch's input endpoints.
    /// This can be used to send a value to either an 'event' or 'value' type input endpoint.
    /// If the endpoint is a 'value' type, then the rampFrames parameter can optionally be used to specify
    /// the number of frames over which the current value should ramp to the new target one.
    /// The value parameter will be coerced to the type that is expected by the endpoint. So for
    /// examples, numbers will be converted to float or integer types, javascript objects and arrays
    /// will be converted into more complex types in as good a fashion is possible.
    sendEventOrValue (endpointID, value, rampFrames)  { this.sendMessageToServer ({ type: "send_value", id: endpointID, value: value, rampFrames: rampFrames }); }

    /// Sends a short MIDI message value to a MIDI endpoint.
    /// The value must be a number encoded with `(byte0 << 16) | (byte1 << 8) | byte2`.
    sendMIDIInputEvent (endpointID, shortMIDICode)    { this.sendEventOrValue (endpointID, { message: shortMIDICode }); }

    /// Tells the patch that a series of changes that constitute a gesture is about to take place
    /// for the given endpoint. Remember to call sendParameterGestureEnd() after they're done!
    sendParameterGestureStart (endpointID)            { this.sendMessageToServer ({ type: "send_gesture_start", id: endpointID }); }

    /// Tells the patch that a gesture started by sendParameterGestureStart() has finished.
    sendParameterGestureEnd (endpointID)              { this.sendMessageToServer ({ type: "send_gesture_end", id: endpointID }); }

    //==============================================================================
    // Stored state control methods:

    /// Requests a callback to any stored-state value listeners with the current value of a given key-value pair.
    /// To attach a listener to receive these events, use addStoredStateValueListener().
    requestStoredStateValue (key)                     { this.sendMessageToServer ({ type: "req_state_value", key: key }); }
    /// Modifies a key-value pair in the patch's stored state.
    sendStoredStateValue (key, newValue)              { this.sendMessageToServer ({ type: "send_state_value", key : key, value: newValue }); }

    /// Attaches a listener function that will be called when any key-value pair in the stored state is changed.
    /// The listener function will receive a message parameter with properties 'key' and 'value'.
    addStoredStateValueListener (listener)            { this.addEventListener    ("state_key_value", listener); }
    /// Removes a listener that was previously added with addStoredStateValueListener().
    removeStoredStateValueListener (listener)         { this.removeEventListener ("state_key_value", listener); }

    /// Applies a complete stored state to the patch.
    /// To get the current complete state, use requestFullStoredState().
    sendFullStoredState (fullState)                   { this.sendMessageToServer ({ type: "send_full_state", value: fullState }); }

    /// Asynchronously requests the full stored state of the patch.
    /// The listener function that is supplied will be called asynchronously with the state as its argument.
    requestFullStoredState (callback)
    {
        const replyType = "fullstate_response_" + (Math.floor (Math.random() * 100000000)).toString();
        this.addSingleUseListener (replyType, callback);
        this.sendMessageToServer ({ type: "req_full_state", replyType: replyType });
    }

    //==============================================================================
    // Listener methods:

    /// Attaches a listener function which will be called whenever an event passes through a specific endpoint.
    /// This can be used to monitor both input and output endpoints.
    /// The listener function will be called with an argument which is the value of the event.
    addEndpointEventListener (endpointID, listener)
    {
        const type = "event_" + endpointID;

        if (this.getNumListenersForType (type) == 0)
            this.sendMessageToServer ({ type: "set_endpoint_event_monitoring",
                                        endpoint: endpointID, active: true });

        this.addEventListener (type, listener);
    }

    /// Removes a listener that was previously added with addEndpointEventListener()
    removeEndpointEventListener (endpointID, listener)
    {
        const type = "event_" + endpointID;
        this.removeEventListener (type, listener);

        if (this.getNumListenersForType (type) == 0)
            this.sendMessageToServer ({ type: "set_endpoint_event_monitoring",
                                        endpoint: endpointID, active: false });
    }

    /// This will trigger an asynchronous callback to any parameter listeners that are
    /// attached, providing them with its up-to-date current value for the given endpoint.
    /// Use addAllParameterListener() to attach a listener to receive the result.
    requestParameterValue (endpointID)                  { this.sendMessageToServer ({ type: "req_param_value", id: endpointID }); }

    /// Attaches a listener function which will be called whenever the value of a specific parameter changes.
    /// The listener function will be called with an argument which is the new value.
    addParameterListener (endpointID, listener)         { this.addEventListener ("param_value_" + endpointID.toString(), listener); }
    /// Removes a listener that was previously added with addParameterListener()
    removeParameterListener (endpointID, listener)      { this.removeEventListener ("param_value_" + endpointID.toString(), listener); }

    /// Attaches a listener function which will be called whenever the value of any parameter changes in the patch.
    /// The listener function will be called with an argument object with the fields 'endpointID' and 'value'.
    addAllParameterListener (listener)                  { this.addEventListener ("param_value", listener); }
    /// Removes a listener that was previously added with addAllParameterListener()
    removeAllParameterListener (listener)               { this.removeEventListener ("param_value", listener); }

    /// This takes a relative path to an asset within the patch bundle, and converts it to a
    /// path relative to the root of the browser that is showing the view.
    /// You need you use this in your view code to translate your asset URLs to a form that
    /// can be safely used in your view's HTML DOM (e.g. in its CSS). This is needed because the
    /// host's HTTP server (which is delivering your view pages) may have a different '/' root
    /// than the root of your patch (e.g. if a single server is serving multiple patch GUIs).
    getResourceAddress (path)                         { return path; }


    //==============================================================================
    // Private methods follow this point..

    /// For internal use - delivers an incoming message object from the underlying API.
    deliverMessageFromServer (msg)
    {
        if (msg.type === "status")
            this.manifest = msg.message?.manifest;

        if (msg.type == "param_value")
            this.dispatchEvent ("param_value_" + msg.message.endpointID, msg.message.value);

        this.dispatchEvent (msg.type, msg.message);
    }
}
