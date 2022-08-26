import { LENSHUB_PROXY_ABI } from '@abis/LensHubProxy'
import { useMutation, useQuery } from '@apollo/client'
import { Button } from '@components/UIElements/Button'
import Tooltip from '@components/UIElements/Tooltip'
import {
  ALLOWANCE_SETTINGS_QUERY,
  BROADCAST_MUTATION,
  CHANNEL_FOLLOW_MODULE_QUERY
} from '@gql/queries'
import { CREATE_FOLLOW_TYPED_DATA } from '@gql/queries/typed-data'
import logger from '@lib/logger'
import useAppStore from '@lib/store'
import usePersistStore from '@lib/store/persist'
import {
  ERROR_MESSAGE,
  LENSHUB_PROXY_ADDRESS,
  RELAYER_ENABLED,
  SIGN_IN_REQUIRED_MESSAGE
} from '@utils/constants'
import omitKey from '@utils/functions/omitKey'
import { utils } from 'ethers'
import React, { FC, useState } from 'react'
import toast from 'react-hot-toast'
import { FeeFollowModuleSettings, Profile } from 'src/types'
import { useContractWrite, useSigner, useSignTypedData } from 'wagmi'

type Props = {
  channel: Profile
  onJoin: () => void
}

const JoinChannel: FC<Props> = ({ channel, onJoin }) => {
  const [loading, setLoading] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)
  const [buttonText, setButtonText] = useState('Join Channel')
  const isAuthenticated = usePersistStore((state) => state.isAuthenticated)
  const userSigNonce = useAppStore((state) => state.userSigNonce)
  const setUserSigNonce = useAppStore((state) => state.setUserSigNonce)

  const onError = (error: any) => {
    toast.error(error?.data?.message ?? error?.message ?? ERROR_MESSAGE)
    setLoading(false)
    setButtonText('Join Channel')
  }

  const onCompleted = () => {
    onJoin()
    toast.success(`Joined ${channel.handle}`)
    setButtonText('Joined Channel')
    setLoading(false)
  }

  const { signTypedDataAsync } = useSignTypedData({
    onError
  })
  const { data: signer } = useSigner({ onError })

  const { write: writeJoinChannel } = useContractWrite({
    addressOrName: LENSHUB_PROXY_ADDRESS,
    contractInterface: LENSHUB_PROXY_ABI,
    functionName: 'followWithSig',
    mode: 'recklesslyUnprepared',
    onSuccess: onCompleted,
    onError
  })

  const [broadcast] = useMutation(BROADCAST_MUTATION, {
    onCompleted,
    onError
  })

  const { data: followModuleData } = useQuery(CHANNEL_FOLLOW_MODULE_QUERY, {
    variables: { request: { profileIds: channel?.id } },
    skip: !channel?.id
  })
  const followModule: FeeFollowModuleSettings =
    followModuleData?.profiles?.items[0]?.followModule

  useQuery(ALLOWANCE_SETTINGS_QUERY, {
    variables: {
      request: {
        currencies: followModule?.amount?.asset?.address,
        followModules: 'FeeFollowModule',
        collectModules: [],
        referenceModules: []
      }
    },
    skip: !followModule?.amount?.asset?.address || !isAuthenticated,
    onCompleted(data) {
      setIsAllowed(data?.approvedModuleAllowanceAmount[0]?.allowance !== '0x00')
    }
  })

  const [createJoinTypedData] = useMutation(CREATE_FOLLOW_TYPED_DATA, {
    async onCompleted(data) {
      const { typedData, id } = data.createFollowTypedData
      try {
        const signature = await signTypedDataAsync({
          domain: omitKey(typedData?.domain, '__typename'),
          types: omitKey(typedData?.types, '__typename'),
          value: omitKey(typedData?.value, '__typename')
        })
        const { v, r, s } = utils.splitSignature(signature)
        const args = {
          follower: signer?.getAddress(),
          profileIds: typedData.value.profileIds,
          datas: typedData.value.datas,
          sig: {
            v,
            r,
            s,
            deadline: typedData.value.deadline
          }
        }
        setUserSigNonce(userSigNonce + 1)
        if (RELAYER_ENABLED) {
          const { data } = await broadcast({
            variables: { request: { id, signature } }
          })
          if (data?.broadcast?.reason)
            writeJoinChannel?.({ recklesslySetUnpreparedArgs: args })
        } else {
          writeJoinChannel?.({ recklesslySetUnpreparedArgs: args })
        }
      } catch (error) {
        logger.error('[Error Join Channel Typed Data]', error)
      }
    },
    onError
  })

  const joinChannel = () => {
    if (!isAuthenticated) return toast.error(SIGN_IN_REQUIRED_MESSAGE)
    if (!isAllowed)
      return toast.error(
        `Menu -> Settings -> Permissions and allow fee follow module for ${followModule.amount.asset.symbol}.`
      )
    setLoading(true)
    setButtonText('Joining...')
    createJoinTypedData({
      variables: {
        options: { overrideSigNonce: userSigNonce },
        request: {
          follow: {
            profile: channel?.id,
            followModule: {
              feeFollowModule: {
                amount: {
                  currency: followModule?.amount?.asset?.address,
                  value: followModule?.amount?.value
                }
              }
            }
          }
        }
      }
    })
  }

  return (
    <Tooltip
      content={
        followModule
          ? `Pay Membership - ${followModule.amount.value} ${followModule.amount.asset.symbol}`
          : buttonText
      }
      placement="top"
    >
      <span>
        <Button onClick={() => joinChannel()} disabled={loading}>
          {buttonText}
        </Button>
      </span>
    </Tooltip>
  )
}

export default JoinChannel
