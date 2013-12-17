[![Build Status](https://travis-ci.org/dmcquay/imagesquish.png)](https://travis-ci.org/dmcquay/imagesquish)

# WHAT IS IMAGESQUISH?

ImageSquish is a standalone service that resizes your images on the fly. It is easy to setup, scales linearly, is cheap to operate because it is very efficient, requires no integration and provides the best experience possible for your users.

# QUICK EXAMPLE

You have this image on your site

    http://www.mysite.com/media/profile_images/12345.jpg

Configure ImageSquish to tell it the following:

* Your images are found at `www.mysite.com`
* Give it an S3 bucket to store sizes in
* Configure your desired sizes (for example, we might configure "small" to be 100x100)

Start the ImageSquish service

    forever start app.js

Assuming you are running ImageSquish on `images.mysite.com`, request the small size with this URL:

    http://images.mysite.com/default/small/media/profile_images/12345.jpg

# WHY IMAGESQUISH?

* Users shouldn't have to wait for sizes to be generated upon upload or see placeholder images while sizes are generated.
* Your app server shouldn't be resizing images. It is CPU and memory hungry and scales differently.
* Images should be generated in parallel when needed, and fast.
* When you need a new image size, you shouldn't have to make some script to reprocess all existing images.
* Image processing should be efficient (save $) and scale linearly.
* It should be really easy so you can worry about more important things.

# HOW DOES IT WORK?

1. ImageSquish is a standalone service. You simply edit the configuration file and then start the service.
1. Image sizes are stored in S3. When you request an image in a certain size from ImageSquish, it makes a request to S3 where that image should be found and streams it back to the user. It acts very much like a reverse proxy.
1. If the image is not found on S3, the 404 response is detected and ImageSquish then generates the size and stores
   it in S3. It then repeats step 2.

# LARGE SCALE? NO PROBLEM

1. Though ImageSquish is robust enough to be used without a CDN, I still highly recommend using a CDN.
1. Scale easily by adding more servers and putting them behind a load balancer or round robin DNS. It scales linearly.
1. You can also just use [imagesquish.com](http://imagesquish.com) if you don't want to worry about hosting ImageSquish yourself.
1. ImageSquish has been tested at high loads. If you manage to exceed what it can handle, it will not crumble. The requests will simply queue up very efficiently with low memory consumption and wait until your server can catch up.

# INSTALL

1. Install node. Good instructions here: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#ubuntu-mint
2. git-clone this repo or download the latest tarball. Just put it in your home directory.
3. Install graphicsmagick. `sudo apt-get install graphicsmagick` or whatever, depending on your OS.
4. Run `npm install` to install all dependencies.
5. Create config/aws.json with your AWS credentials. (see example below)
6. Create config/config.json. (see example below)
7. Run using Forever. `npm install forever -g` and then `forever start app.js`.
   Learn more about forever at http://blog.nodejitsu.com/keep-a-nodejs-server-up-with-forever.

Note about running on port 80. Only root can do that, but you should not run this as root. Instead, I suggest
one of these options:

1. Use iptables to redirect port 80 to another port.
   `sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000`
2. Just run it on port 3000. You should be putting a CDN in front of this anyway, which will hide your weird port
   from your users.


# IMAGESQUISH API

## The Config Files

ImageSquish needs two configuration files. The first config/aws.json and it stores your AWS credentials. This is needed
to store your various image sizes in S3. Example:

```js
{
    "accessKeyId": "[MY_ACCESS_KEY_ID]",
    "secretAccessKey": "[MY_SECRET_ACCESS_KEY]"
}
```

The second config file is config/config.json. Here's a basic example:

```js
{
    "buckets": {
        "test": {  // Everthing is grouped into buckets (not to be confused with AWS S3 buckets)
            "originHost": "www.mysite.com",               // Origin server for your images
            "manipulationsS3Bucket": "com-athlete-ezimg", // Where to store your sizes (called "manipulations")

            // And here are the actual size definitions (aka "manipulations")
            "manipulations": {
                "small": [
                    {
                        "operation": "resize",
                        "params": [100, 100]
                    },
                    {
                        // You can provide multiple operations per manipulation, to be executed sequentially.
                        "operation": "autoOrient"
                    }
                ]
            }
        }
    }
}
```

## Supported Operations

Each operation and parameters are passed directly to graphics magick.

See docs here: http://aheckmann.github.io/gm/

Some custom operations are also provided. Feel free to fork and add to this.

https://github.com/dmcquay/imagesquish/blob/master/operations.js


## URL Structure

Once you have ImageSquish server configured, all that is left is to form your URLs correctly.

    http://{imagesquish_host}/{bucket}/{manipulation}/{image_path}

In the configuration example above, let's say I have the following original image on my server.

    http://www.mysite.com/profile_images/12345.jpg

And let's say I have ImageSquish running on the host images.mysite.com and I want to the `small`
size (aka "manipulation") that we defined above.

    http://images.mysite.com/test/small/profile_images/12345.jpg

Where "test" is the bucket, "small" is the manipulation and "profile_images/12345.jpg" is the image path.

If you add `"allowOTFManipulations": true` to your bucket config, you could also request it like this:

    http://images.mysite.com/test/otf:resize(100,100)/profile_images/12345.jpg


# Configuration Options

The important config options have already been mentioned, but here's a detailed list including some we haven't covered yet.

## Global configuration options

* `port` - The port ImageSquish should listen on. Defaults to 3000.
* `maxConcurrentProxyStreams` - The maximum number of images that can be streamed from S3 or the origin server to the user. 20-40 is recommended. Defaults to 20.
* `maxConcurrentManipulations` - The maximum number of uncached manipulations that can be executed concurrently. As you surpass the number of CPUs on your server, you'll soon start to see performance degredation. It defaults to the number of CPUs available. I recommend you use this default.

## Per-bucket configuration options

* `originHost` - Required. The host where your original images can be found.
* `originPathPrefix` - Optional. Will be prefixed to all your image paths. Useful for making your ImageSquish URLs shorter. So instead of `http://images.mysite.com/default/small/profile_images/12345.jpg`, you can set `"originPathPrefix": "profile_images/"` and then your URL becomes `http://images.mysite.com/default/small/12345.jpg`.
* `manipulationsS3Bucket` - Required. The Amazon S3 bucket where your cached images should be stored
* `manipulationKeyFormat` - The S3 key for storing your manipulations. Defaults to `imagesquish/{bucket}/{manipulation}/{imgId}`. There should be no need to change this.
* `manipulations` - See the config example above
* `allowOTFManipulations` - Defeault is `false`. If this is `true`, then you don't have to pre-configure your manipulations. Instead you can just form URLs like this: `http://images.mysite.com/default/otf:resize(100)/12345.jpg`. This makes you vulnerable to DOS attacks, so if you want to be extra careful, leave this disabled.

Note: there are some additional options for uploading. See "UPLOAD IMAGES" section below.

# STATUS

You can get some status information at /status which looks something like this. It should give you a pretty good idea of how well your instance is handling current load.

```js
{
  "manipulations": {
    "currentCount": 1,
    "limit": 1,
    "currentQueueSize": 1,
    "averageQueueSizes": {
      "lastMinute": 0.16666666666666666,
      "lastHour": 0.01680672268907563,
      "lastDay": 0.0033277870216306157
    },
    "activeManipulations": [
      "imagesquish/test/otf:resize(163,121)/IMG_1296.JPG",
      "imagesquish/test/otf:resize(152,168)/IMG_1296.JPG"
    ]
  },
  "proxyStreams": {
    "currentCount": 1,
    "limit": 1,
    "currentQueueSize": 217,
    "averageQueueSizes": {
      "lastMinute": 145.25,
      "lastHour": 14.647058823529411,
      "lastDay": 7.063227953410982
    }
  }
}
```

# DJANGO INTEGRATION

Here's a simple way to make ImageSquish really easy to use with Django. Just use this
field in your model definition instead of models.ImageField.

```python
import re
from django.conf import settings
from django.db import models
from django.db.models.fields.files import ImageFieldFile
from south.modelsinspector import add_introspection_rules

class ImageSquishFieldFile(ImageFieldFile):
    def __getattribute__(self, name):
        match = re.match('^url_(.*)$', name)
        if not match:
            return object.__getattribute__(self, name)
        else:
            manipulation = match.group(1)
            return object.__getattribute__(
                self, 'get_manipulation_url')(manipulation)

    def get_manipulation_url(self, manipulation):
        return self.field.imagesquish_url_pattern.format(
            base_url=settings.IMAGESQUISH_BASE_URL,
            bucket=self.field.imagesquish_bucket,
            manipulation=manipulation,
            img_path=str(self))


class ImageSquishField(models.ImageField):
    attr_class = ImageSquishFieldFile
    imagesquish_bucket = 'default'
    imagesquish_url_pattern = '{base_url}/{bucket}/{manipulation}/{img_path}'


add_introspection_rules([], ["^athlete\.db\.fields\.ImageSquishField"])
```

Then use in your model.

```python
class UserProfile:
    image = ImageSquishField(upload_to='profile_images')
```

And then you can get the "small" size like this:

```python
profile.image.url_small
```

# IMAGESQUISH IN THE WILD

ImageSquish was developed by Dustin McQuay, developer at Athlete.com, where it is currently being used and performing
superbly. Let us know if you're using it too!


# NEED HELP?

ImageSquish is awesome and is easy to use, but if you get stuck, just submit an issue on GitHub and add the "question" label. I'm happy to help.


# UPLOADING IMAGES

ImageSquish supports image uploads too, though it is not widely used or supported at this point. If you want to try it out, add `"allowWrite": true` to your bucket config and then try uploading an image via the command line like this:

curl http://localhost:3000/default/upload --data-binary @Scan.jpeg -H "Content-Type:image/jpeg" -v

By default it stores the uploaded images to the same bucket as your cached sizes, but you can configure that with `originalsS3Bucket` in your bucket config.

By default the S3 key for uploaded images is `{bucket}/originals/{imgId}` and you can configure that with `originalKeyFormat` in your bucket config.


# LICENSE

The MIT License (MIT)

Copyright (c) 2013 Dustin McQuay

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
