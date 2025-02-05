"use client"
import Image, { ImageProps } from "next/image"
import { FC, ReactEventHandler, useState } from "react"

const IpfsImage: FC<ImageProps> = (props) => {
    const { alt, onLoad, className, ...rest } = props
    const [loading, setLoading] = useState(true)

    const handleLoad: ReactEventHandler<HTMLImageElement> = (e) => {
        setLoading(false)
        onLoad?.(e)
    }

    return (
        <Image
            alt={alt}
            onLoad={handleLoad}
            className={`${loading ? "skeleton" : ""} ${className}`}
            {...rest}
        />
    )
}

export default IpfsImage
