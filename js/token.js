/*
Copyright (c) 2011 Rdio Inc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */

// To use the playback API you need to obtain a playback token for your domain.
// The simplest way to do this is to grab the rdio-python library:
//   https://github.com/rdio/rdio-python
// and use the rdio-call tool to get a playback token for your domain
//   ./rdio-call --consumer-key=YOUR_CONSUMER_KEY --consumer-secret=YOUR_CONSUMER_SECRET getPlaybackToken domain=YOUR_DOMAIN
// it will respond with
//   {"status": "ok", "result": "YOUR_PLAYBACK_TOKEN"}
// if you want to do playback as a particular user, pass --authenticate to rdio-call
// then update playback_token below with YOUR_PLAYBACK_TOKEN and the domain below with YOUR_DOMAIN

var playback_token = "";
var domain = "";

// used for communicating with The Echo Nest API
var version = "v1.0";
var host = 'developer.echonest.com';
var echonest_key = ""; 
var std_sim_params = "?api_key="+ echonest_key +"&bucket=id:rdio-us-streaming&limit=true";
