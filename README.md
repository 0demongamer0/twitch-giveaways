# Twitch Giveaways

Comfortable giveaways system for [Twitch.tv](https://twitch.tv) channels.

![Screenshot](https://s3.amazonaws.com/crosseyejack.com/Files/screenshot.png)

## Why the fork?

Simply put, there were a few things I didn't like about the original so I forked it to make the changes I wanted.

## What didn't you like about the original?

I didn't like how the ad's were baked in without any ability to filter or disable them. I believe that streamers should have full control of what is shown on their streams.
Baking in the ad's removes this ability, So I wanted to add a control to disable them. It is my intension to link the ads back to the orig version at some point.

I also didn't like how the settings I used in this extension reset when I loaded it so I want to fix that issue.

And there are a few other issues I will fix and post about once I get around to fixing them.

## Installation

- [Chrome Web Store](https://chrome.google.com/webstore/detail/twitch-giveaways/gnjjpnkophpiopnmfkbdkeejhmlcioao)

## Technologies used

[component(1)](https://github.com/component/component) - Opinionated package manager & builder made for the front end world.

[Mithril](https://github.com/lhorie/mithril.js) - Fast and simple immediate mode framework.

[Gulp](https://github.com/gulpjs/gulp) - Streams oriented build system.

... and lots of small libraries listed in [component.json](https://github.com/darsain/twitch-giveaways/blob/master/component.json).

## Development environment

You need to have [nodejs](https://nodejs.org/) installed.

Gulp:

```
npm install -g gulp-cli
```

Gulp tasks dependencies:

```
npm install
```

You will also need a ton of component dependencies that have seemed to stopped working since its deprecation for one reason or another.

Download the archive of dependencies and extract the "components" folder into the root of the project.
https://s3.amazonaws.com/crosseyejack.com/Files/components.zip

The required dependencies to build are as follows if you want to download them yourself.
aheckmann/sliced/1.0.1
code42day/dataset/v0.3.2
component/bind/1.0.0
component/classes/1.2.6
component/clone/0.2.3
component/closest/1.0.1
component/delegate/0.2.4
component/emitter/1.2.1
component/escape-regexp/1.0.2
component/event/0.1.4
component/events/1.0.10
component/indexof/0.0.3
component/inherit/0.0.3
component/matches-selector/0.1.6
component/query/0.0.3
component/raf/1.2.0
component/throttle/1.0.0
component/type/v1.2.1
darsain/constructor-apply/0.1.0
darsain/definer/1.0.0
darsain/e/1.2.1
darsain/event/1.0.0
darsain/extend/1.0.0
darsain/fuse/1.0.0
darsain/isarraylike/1.0.0
darsain/iswindow/1.0.0
darsain/list/1.0.0
darsain/parse-number/1.0.0
darsain/position/1.0.0
darsain/raft/1.0.0
darsain/sortedlist/0.0.2
darsain/tooltip/0.1.0
darsain/tooltips/0.1.0
eivindfjeldstad/dot/0.1.0
ianstormtaylor/to-no-case/0.1.1
ianstormtaylor/to-sentence-case/1.0.0
jkroso/computed-style/0.1.0
lhorie/mithril/v0.1.34
yields/isarray/1.0.0

You will also need to update the pinned dependencies by running.

```
component update
```

After which you should be able to build this project.

## If component is deprecated why continue to use it?

Good Question. Basically for me it comes down to if I were to replace component then I would just rewrite the whole thing from the ground up.
I'll prob do that one day, just not got the free time to do it just yet.

## Gulp tasks

To run any of the tasks below, write `gulp taskname` into your console.

In general, you should be interested only in **build**, **serve**, and **watch** tasks.

### *default*

Runs **build** & **watch**.

Default task can be run simply by:

```
gulp
```

### assets

Copies static assets like images and manifest into `build/` directory.

### build

Builds the whole app into the `build/` directory.

Available arguments:

- `-P --production` - Build a production version that minifies resources and doesn't include sourcemaps.

Example:

```
gulp build -P
gulp build -production
```

### bump

Bump the `manifest.json` version.

Available arguments:

- `-t --type=[name]` - Pick which semantic version should be bumped. Can be: **patch** (default), **minor**, **major**, or a direct version.

Example:

```
-> version: 1.0.0
gulp bump
-> version: 1.0.1
gulp bump -t patch
-> version: 1.0.2
gulp bump -t minor
-> version: 1.1.0
gulp bump -t 2.2.2
-> version: 2.2.2
```

### clean

Deletes the `build/` directory.

### icons

Builds the `icons.svg` sprite from `src/icon/` icons into `build/` directory.

### package

Will package the production version of the app into a zip file.

### release

Will bump the `manifest.json` version and package the app into a zip file.

Accepts **bump** arguments.

### scripts

Builds scripts into `build/` directory.

### styles

Builds styles into `build/` directory.

### watch

Starts watching scripts, styles, and assets for changes, and builds what is necessary.

On script changes, you need to reload the extension via chrome Extensions Developmer mode. On style & asset changes, just F5 the twitch chat.
