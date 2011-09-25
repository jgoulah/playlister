
// a global variable that will hold a reference to the api swf once it has loaded
var apiswf = null;

// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){

  // song Model
  // ----------

  window.Song = Backbone.Model.extend({

    // Default attributes for a song item.
    defaults: function() {
      return {
        done:  false,
        nowPlaying: false,
        order: Songs.nextOrder()
      };
    },

    // Toggle the `done` state of this song item.
    toggleDone: function() {
      this.save({done: !this.get("done")});
    },

    toggleNowPlaying: function() {
      this.save({nowPlaying: !this.get("nowPlaying")});
    },

  });

  window.TempSongList = Backbone.Collection.extend({

    model: Song,

    // random b/c we dont want to save this every time
    // probably better way to do this...
    localStorage: new Store("tempsongs"+Math.random()),
  });

  // song Collection
  // ---------------

  // The collection of songs is backed by *localStorage* instead of a remote
  // server.
  window.SongList = Backbone.Collection.extend({

    // Reference to this collection's model.
    model: Song,

    // Save all of the song items under the `"songs"` namespace.
    localStorage: new Store("songs"),

    // Filter down the list of all song items that are finished.
    done: function() {
      return this.filter(function(song){ return song.get('done'); });
    },

    nowPlaying: function() {
      return this.filter(function(song){ return song.get('nowPlaying'); });
    },

    // Filter down the list to only song items that are still not finished.
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    // We keep the songs in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // songs are sorted by their original insertion order.
    comparator: function(song) {
      return song.get('order');
    }

  });
  // Create our global collection of **songs**.
  window.Songs = new SongList;

  window.SongPickListElem = Backbone.View.extend({
    //... is a list tag.
    tagName:  "li",
    // Cache the template function for a single item.
    template: _.template($('#pickitem-template').html()),

    events: {
      //"click span.picksong-text"       : "songPicked",
      "click div.picksong-info"       : "songPicked",
    },

    songPicked: function() {
      $('#picksong').overlay().close();
      // the add bind in AppView will add the song to the view
      // if we dont call toJSON here it tries to store in the temp colleciton
      var song = Songs.create(this.model.toJSON());
      var nowplaying = Songs.nowPlaying();
      if (!nowplaying.length) {
        window.App.playerView.playSong(song);
      }
    },

    setText: function() {
      var name = this.model.get('name');
      var artist = this.model.get('artist');

      this.$('.picksong-text').text(name);
      this.$('.picksong-artist').text(artist);
    },
    
    // Re-render the contents of the song item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setText();
      return this;
    },
  });

  // song Item View
  // --------------

  // The DOM element for a song item...
  window.SongView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "li",

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .check"              : "toggleDone",
      "click div.song-text"       : "playSong",
      "click span.song-destroy"   : "clear",
      "keypress .song-input"      : "updateOnEnter"
    },

    // The songView listens for changes to its model, re-rendering.
    initialize: function() {
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
    },

    // Re-render the contents of the song item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setText();
      return this;
    },

    playSong: function(song) {
      window.App.playerView.playSong(this.model);
    },

    // To avoid XSS (not that it would be harmful in this particular app),
    // we use `jQuery.text` to set the contents of the song item.
    setText: function() {
      var name = this.model.get('name');
      this.$('.song-text').text(name);
      this.input = this.$('.song-input');
      //this.input.bind('blur', _.bind(this.close, this)).val(name);
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggleDone();
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // Remove this view from the DOM.
    remove: function() {
      $(this.el).remove();
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.destroy();
    }

  });

  window.SongPickView = Backbone.View.extend({
    el: "#picksong",
    template: _.template($('#picksong-template').html()),
    events: {
      "click button.close"       : "cancelled",
    },

    cancelled: function() {
      $(this.el).overlay().close();
    },

    render: function() {

        $(this.el).html(this.template());
        this.collection.each( function( song ){
            var view = new SongPickListElem({model: song});
            this.$("#songpick-list").append(view.render().el);
        });

        var triggers = $(this.el).overlay({
            // some mask tweaks suitable for modal dialogs
            mask: {
                color: '#ebecff',
                loadSpeed: 200,
                opacity: 0.9
            },

            closeOnClick: false,
            load: true
        }).load();

      return this;
    },
  });

  window.PlayerView = Backbone.View.extend({

    el: "#rdio-player",

    // Cache the template function for a single item.
    template: _.template($('#player-template').html()),
    nowplaying: null,
    paused: false,

    render: function() {
      $(this.el).html(this.template());
      return this;
    },

    // The DOM events specific to an item.
    events: {
      "click #pause"             : "pauseSong",
      "click #prev"              : "prevSong",
      "click #next"              : "nextSong",
    },

    // The songView listens for changes to its model, re-rendering.
    initialize: function() {

        // on page load use SWFObject to load the API swf into div#apiswf
        var flashvars = {
            'playbackToken': playback_token, // from token.js
            'domain': domain,                // from token.js
            'listener': 'callback_object'    // the global name of the object that will receive callbacks from the SWF
        };
        var params = {
            'allowScriptAccess': 'always'
        };
        var attributes = {};
        swfobject.embedSWF('http://www.rdio.com/api/swf/', // the location of the Rdio Playback API SWF
                'apiswf', // the ID of the element that will be replaced with the SWF
                1, 1, '9.0.0', 'expressInstall.swf', flashvars, params, attributes);
    },

    playSong: function(song) {
      if (song === undefined) return;
      var name = song.get('name');
      var artist = song.get('artist');
      var rdio_id = song.get('rdio_id');
      //console.log('playSong: name:' + name + " artist: "+ artist +" id: " + rdio_id);

      // toggle off nowplaying if its not the same song (can happen on page load)
      if (this.nowplaying != null && (rdio_id != this.nowplaying.get('rdio_id'))) {
          this.nowplaying.toggleNowPlaying();
      } 

      // set this song as currently playing
      if (song.get('nowPlaying') == false) {
        song.toggleNowPlaying();
      }

      // play song
      this.nowplaying = song;
      this.playId(rdio_id);
    },

    playId: function(id) {
        apiswf.rdio_play(id);
        this.paused = false;
    },

    pauseSong: function() {
      if (!this.paused) {
        apiswf.rdio_pause();
        this.paused = true;
      } else {
        apiswf.rdio_play();
        this.paused = false;
      }
    },

    prevSong: function() {
      prevsong = Songs.prev(this.nowplaying);
      this.playSong(prevsong);
    },

    nextSong: function() {
      nextsong = Songs.next(this.nowplaying);
      this.playSong(nextsong);
    },
  });


  // The Application
  // ---------------

  // Our overall **AppView** is the top-level piece of UI.
  window.AppView = Backbone.View.extend({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#songapp"),

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),
    playerView: new PlayerView(),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "keypress #new-song":  "createOnEnter",
      "keyup #new-song":     "showTooltip",
      "click .song-clear a": "clearCompleted"
    },

    // At initialization we bind to the relevant events on the `songs`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting songs that might be saved in *localStorage*.
    initialize: function() {
      this.playerView.render();

      this.input = this.$("#new-song");

      Songs.bind('add',   this.addOne, this);
      Songs.bind('reset', this.addAll, this);
      Songs.bind('all',   this.render, this);

      Songs.fetch();
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      this.$('#song-stats').html(this.statsTemplate({
        total:      Songs.length,
        done:       Songs.done().length,
        remaining:  Songs.remaining().length
      }));
    },

    // Add a single song item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(song) {
      var view = new SongView({model: song});
      this.$("#song-list").append(view.render().el);
    },

    // Add all items in the **songs** collection at once.
    addAll: function() {
      Songs.each(this.addOne);
    },

    // If you hit return in the main input field, and there is text to save,
    // create new **song** model persisting it to *localStorage*.
    createOnEnter: function(e) {
      var name = this.input.val();
      if (!name || e.keyCode != 13) return;

      // finds songs and kicks off the picker dialog
      this.fetchSongByName(name);
      this.input.val('');
    },

    fetchSongByName: function(name) {
        var url ="http://" + host + "/api/v4/song/search" + std_sim_params;
        var self = this;

        $.ajax({
           type: "GET",
           url: url,
           dataType: "jsonp",
           cache: true, // dont append timestamp
           data: { title: name, results: 20, format: "jsonp", sort: 'song_hotttnesss-desc' },
           success: function(data){

                var songs = data.response.songs;
                var templist = new TempSongList;

                _.each(songs, function(song){ 
                    if (song.foreign_ids && song.foreign_ids.length > 0) {
                        id_str = song.foreign_ids[0].foreign_id;
                        rdio_id = _.last(id_str.split(':'));
                        song = new Song({
                            name: song.title, 
                            artist: song.artist_name, 
                            rdio_id: rdio_id
                        })
                        templist.add(song);
                    }
                });

                new SongPickView({collection: templist}).render();
           }
         });

     },


    // Clear all done song items, destroying their models.
    clearCompleted: function() {
      _.each(Songs.done(), function(song){ song.destroy(); });
      return false;
    },

    // Lazily show the tooltip that tells you to press `enter` to save
    // a new song item, after one second.
    showTooltip: function(e) {
      var tooltip = this.$(".ui-tooltip-top");
      var val = this.input.val();
      tooltip.fadeOut();
      if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
      if (val == '' || val == this.input.attr('placeholder')) return;
      var show = function(){ tooltip.show().fadeIn(); };
      this.tooltipTimeout = _.delay(show, 1000);
    }

  });

  // Finally, we kick things off by creating the **App**.
  window.App = new AppView;

  // rdio swf takes a second to load in
  setTimeout(function() {
      var nowplaying = Songs.nowPlaying();
      if (nowplaying.length) {
        window.App.playerView.playSong(_.first(nowplaying));
      }
  }, 2500);

});
