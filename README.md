# WHAT IS IMAGESQUISH?

ImageSquish resizes your images on the fly. Let's say your users can upload a profile image.
You need that image in a few different sizes through the site. The user would upload the image
and you would store it wherever you want and display the original on your site like this.

    <img src="www.mysite.com/media/profile_images/12345.jpg">

If you wanted a 100px version of this, you would define the "small" size in imagesquish like this:

    "small": [{
        'operation': 'resize',
        'params': [100, 100]
    }]

And then you would request the image like this:

    <img src="images.mysite.com/um/default/small/media/profile_images/12345.jpg">

# WHY IMAGESQUISH?

I have dealt with user uploaded images on many websites. Scaling them isn't terribly hard to to
but it is annoying. After doing this for a long time, ImageSquish is the absolute best way to
handle image resizing both for the developer and for your users.

# Best for users

If you create your images on your web application, the user typically has to wait, either at
upload time or when viewing the images. ImageSquish avoids this. There is no wait at upload time
since images are generated on the fly when viewing instead. And since the web application does
not generate them, it doesn't slow down loading of the web page. The browser already will load
the page for you before images and then the images can load asynchronously as they are generated.
Furthermore, ImageSquish is very fast, so the wait is typically sub-second. And it is VERY well cached
for future requests (explained in more detail below).

# Best for developers

As a developer, you have a few different options for user-uploaded images. Here's a breakdown of why
they all suck a little bit.

1. Generate your sizes at upload time in the main application code
    1. You have to implement code to do the resizing
    1. The image resizing will slow down your web app
    1. Your users have to wait extra long when uploading for the resizing to process
    1. When you need a new size, you have to write some script to create that size for all images in batch
1. Generate your sizes on page view (example sorl.thumbnail)
    1. Slows down page loads tremendously, especially if multiple images need to be generated
1. Generate sizes async, like the big boys do it
    1. If you want to do this right, typically you would kick off some async service to process the image
       sizes for you. This way your user doesn't have to wait and your image processing can scale separate
       from your app, and therefore it won't slow your app down either.
    1. But...this means setting up a separate service, having some way to show placeholder images while
       you wait for sizes to be generated (bad user experience), and some sort of pub-sub type setup so the
       image processing can tell your web app when the new sizes are ready. Transloadit is a great service
       to help you get this done, but there's still a lot more to set up. More to break, etc.
    1. And you still have to set up a way to reprocess old images when you add a new size.

ImageSquish blows all these methods out of the water.

1. User doesn't wait at upload
1. Your application scales separately from ImageSquish and is never slowed by it
1. Images that are never viewed are never generated
1. And of course, ImageSquish is extremely fast and resource efficient

# How does it work?

1. A image is requested of a certain size (let's say "small")
1. ImageSquish makes a proxy request to S3 where that image should be found, if it exists
1. The S3 response is immediately streamed back to the user, headers and all. So it is basically a reverse proxy for S3.
   An AWS t1.micro instance can easily stream 20 images in parallel without sweating.
1. If the image is not found on S3, the 404 response is detected and ImageSquish then generates the size and stores
   it in S3. It then repeats steps 2 and 3.
1. Because ImageSquish is just a reverse proxy for S3, cache related headers are passed on. Therefore, it works
   beautifully with a CDN of your choice and conditional gets are also supported.

# INSTALL

Soon we'll have an npm install, so it will just be `npm install imagesquish`. Until then...

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

To test uploading an image on the command line:

curl http://localhost:3000/default/upload --data-binary @Scan.jpeg -H "Content-Type:image/jpeg" -v

For manipulation configurations, see the node gm docs:

http://aheckmann.github.io/gm/docs.html#manipulation

I have also provided some custom operations:

squareCenterCrop(size)

# IMAGESQUISH API

## The config files

ImageSquish needs two configuration files. The first config/aws.json and it stores your AWS credentials. This is needed
to store your various image sizes in S3. Example:

    {
        "accessKeyId": "[MY_ACCESS_KEY_ID]",
        "secretAccessKey": "[MY_SECRET_ACCESS_KEY]"
    }

The second config file is config/config.json. Here's an example:

    {
        "maxConcurrentManipulations": 8,   // you should set to the number of cores on your server
        "maxConcurrentProxyStreams": 20,   // 20-40 is recommended, depending on your server's IO and network performance
        "port": 3000,
        "buckets": {
            "test": {  // Everthing is grouped into buckets (not to be confused with AWS S3 buckets)
                "originalsS3Bucket": "com-athlete-ezimg",     // Where to find your originals. this will be replaced soon by "originHost" since there is no need for your originals to reside in S3.
                "manipulationsS3Bucket": "com-athlete-ezimg", // Where to store your sizes (called "manipulations")
                "allowWrite": true,                           // ImageSquish supports uploads too, which you can enable/disable here.
                "allowOTFManipulations": true,                // Instead of "small" as the size, you can say "resize(100,150)". This is convenient, but also make you vulnerable to DOS attacks. Enable here if you wish.
                "originalKeyFormat": "{imgId}",               // (optional) Allows you to provide a prefix for where to find your originals. This helps to make ImageSquish URLs shorter.
                "manipulationKeyFormat": "manipulations/{imgId}/{manipulation}",
                                                              // How to form the S3 key for where image sizes (aka "manipulations") should be stored

                // And here are the actual size definitions (aka "manipulations")
                "manipulations": {
                    "small": [
                        {
                            // Each operation & parameters are passed directly to graphics magick.
                            // See docs here: http://aheckmann.github.io/gm/
                            // You can provide multiple operations per manipulation, to be executed
                            // sequentially.
                            "operation": "resize",
                            "params": [100, 100]
                        }
                    ]
                }
            }
        }
    }

## ImageSquish URLs

Once you have ImageSquish server configured, all that is left is to form your URLs correctly.

`http://localhost:3000/um/{bucket}/{size}/{image_path}`

In the configuration example above, if I wanted to request /profile_images/12345.jpg in size "small", the URL
would look like this:

`http://localhost:3000/um/test/small/12345.jpg`

If `allowOTFManipulations` is true, you could also request it like this:

`http://localhost:3000/um/test/otf:resize(100,100)/12345.jpg`


# DJANGO INTEGRATION

Athlete.com uses Django. Here's a simple way to make ImageSquish really easy to use with Django. Just use this
field in your model definition instead of models.ImageField.

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
                img_id=str(self))


    class ImageSquishField(models.ImageField):
        attr_class = ImageSquishFieldFile
        imagesquish_bucket = 'default'
        imagesquish_url_pattern = '{base_url}/um/{bucket}/{manipulation}/{img_id}'


    add_introspection_rules([], ["^athlete\.db\.fields\.ImageSquishField"])

Then use in your model.

    class UserProfile:
        image = ImageSquishField(upload_to='profile_images')

And then you can get the "small" size like this:

    profile.image.url_small


# PERFORMANCE

1. Because ImageSquish is built on nodejs, it easily handles spikes in traffic. I'm not just a nodejs fanboy. It
   really does support this use case very well. Let me explain. If your server receives 1000 resize
   requests all at once, they are simply queued up and processed as fast as possible. If your server is too small
   to keep up with the requests, then the requests will take a while to be served, but ImageSquish will not crumble.
   Each queued request takes very little memory and they just sit and wait very politely.
1. Setting up a cluster of servers is very easy because the nodes don't even need to communicate. Just make as many
   as you want and put them behind a load balancer or round robing DNS or similar.
1. It would also be very easy to share the queue size of each node such that it could be used for AWS auto-scaling.


# ImageSquish in the wild

ImageSquish was developed by Dustin McQuay, developer at Athlete.com, where it is currently being used and performing
superbly. Let us know if you're using it too!


# Need Help?

ImageSquish is awesome and is easy to use, but it may seem a little hard because the docs aren't great yet and the API
could use some simplifying. I am very willing to help you get ImageSquish set up if you have questions. It should only
take a few minutes of my time to get you going. You can get my email from my
[github profile](https://github.com/dmcquay).


# ImageSquish as a hosted service

Your image squish server(s) are unlikely to be consistently maxed out. Therefore you will have some wasted resources.
Therefore, we should be able to reduce costs by sharing the service. In addition, you won't have to set up or monitor
anything. If you're interested, head on over to [imagesquish.com](imagesquish.com) and request to join our private beta.


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