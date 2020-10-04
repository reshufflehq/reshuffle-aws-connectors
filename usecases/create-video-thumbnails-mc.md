# Create video thumbnails

Everyone knows how to create thumbnails for images. But can we do it for
videos? Surely this will take massive amounts of code, no?

Not with Reshuffle!

## Ingredients:

* __1__ [S3](https://aws.amazon.com/s3/) bucket

* __1__ [mediainfo](https://mediaarea.net/en/MediaInfo) utility, [precompiled for lambda](https://mediaarea.net/download/binary/mediainfo/20.08/MediaInfo_CLI_20.08_Lambda.zip)

* __1__ Reshuffle

## Preparation:

1. Create an S3 bucket. Make it open for public read (in a real app, you can
configure roles to real from closed buckets as well)

1. Set up the following environment variables:

&nbsp;&nbsp;&nbsp;&nbsp;AWS_ACCESS_KEY_ID

&nbsp;&nbsp;&nbsp;&nbsp;AWS_SECRET_ACCESS_KEY

&nbsp;&nbsp;&nbsp;&nbsp;AWS_DEFAULT_REGION

&nbsp;&nbsp;&nbsp;&nbsp;AWS_DEFAULT_BUCKET

## Workflow:

1. Run [create-video-thumbnails-mc.js](./create-video-thumbnails-mc.js) on Reshuffle

1. Drop video file into your S3 bucket

1. Reshuffle picks it up and uses Lambda to run the MediaInfo command line utility to get information on the video

1. Reshuffle looks at video frame size infomation. If the frame is large,
Reshuffle starts transcoding job and tracks job until thumbnail is ready. If
it's small, Reshuffle simply copies the file into target bucket.

## Bonus:

We also provide an API endpoint for listing all the generated thumbnail video files.
