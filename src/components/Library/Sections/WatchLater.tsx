import VideoCard from '@components/Common/VideoCard'
import { NoDataFound } from '@components/UIElements/NoDataFound'
import useAppStore from '@lib/store'
import { WATCH_LATER_LIBRARY } from '@utils/url-path'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { MdOutlineWatchLater } from 'react-icons/md'
import { LenstubePublication } from 'src/types/local'

const WatchLater = () => {
  const { watchLater } = useAppStore()
  const [videos, setVideos] = useState<LenstubePublication[]>([])

  useEffect(() => {
    setVideos(watchLater)
  }, [watchLater])

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="inline-flex items-center space-x-2 text-lg font-semibold">
          <MdOutlineWatchLater />
          <span>Watch Later</span>
        </h1>
        <Link href={WATCH_LATER_LIBRARY}>
          <a className="flex items-center space-x-0.5 text-xs text-green-900">
            <span>See all</span> <BiChevronRight />
          </a>
        </Link>
      </div>
      {!videos.length && <NoDataFound text="This list has no videos." />}
      <div className="grid gap-x-4 lg:grid-cols-4 gap-y-1 md:gap-y-6 2xl:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 xs:grid-col-1">
        {videos.map((video: LenstubePublication, idx: number) => (
          <VideoCard key={idx} video={video} />
        ))}
      </div>
    </div>
  )
}

export default WatchLater
