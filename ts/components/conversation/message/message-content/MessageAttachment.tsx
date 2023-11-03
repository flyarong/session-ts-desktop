import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import classNames from 'classnames';
import { clone } from 'lodash';
import { Data } from '../../../../data/data';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import {
  PropsForAttachment,
  showLightBox,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import {
  getMessageAttachmentProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import {
  AttachmentType,
  AttachmentTypeWithPath,
  canDisplayImage,
  getExtensionForDisplay,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isVideo,
} from '../../../../types/Attachment';
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';
import { Spinner } from '../../../basic/Spinner';
import { AudioPlayerWithEncryptedFile } from '../../H5AudioPlayer';
import { ImageGrid } from '../../ImageGrid';
import { LightBoxOptions } from '../../SessionConversation';
import { ClickToTrustSender } from './ClickToTrustSender';
import { StyledMessageHighlighter } from './MessageContent';

export type MessageAttachmentSelectorProps = Pick<
  MessageRenderingProps,
  | 'isTrustedForAttachmentDownload'
  | 'direction'
  | 'timestamp'
  | 'serverTimestamp'
  | 'sender'
  | 'convoId'
> & {
  attachments: Array<PropsForAttachment>;
};

type Props = {
  messageId: string;
  imageBroken: boolean;
  handleImageError: () => void;
  highlight?: boolean;
};

const StyledAttachmentContainer = styled.div<{
  messageDirection: MessageModelType;
}>`
  text-align: center;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: ${props => (props.messageDirection === 'incoming' ? 'flex-start' : 'flex-end')};
`;

export const MessageAttachment = (props: Props) => {
  const { messageId, imageBroken, handleImageError, highlight = false } = props;

  const dispatch = useDispatch();
  const attachmentProps = useSelector(state => getMessageAttachmentProps(state as any, messageId));

  const multiSelectMode = useSelector(isMessageSelectionMode);
  const onClickOnImageGrid = useCallback(
    (attachment: AttachmentTypeWithPath | AttachmentType) => {
      if (multiSelectMode) {
        dispatch(toggleSelectedMessageId(messageId));
      } else {
        void onClickAttachment({
          attachment,
          messageId,
        });
      }
    },
    [dispatch, messageId, multiSelectMode]
  );

  const onClickOnGenericAttachment = useCallback(
    (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      if (!attachmentProps?.attachments?.length) {
        return;
      }

      const messageTimestamp = attachmentProps?.timestamp || attachmentProps?.serverTimestamp || 0;
      if (attachmentProps?.sender && attachmentProps?.convoId) {
        void saveAttachmentToDisk({
          attachment: attachmentProps?.attachments[0],
          messageTimestamp,
          messageSender: attachmentProps?.sender,
          conversationId: attachmentProps?.convoId,
          index: 0,
        });
      }
    },
    [
      attachmentProps?.attachments,
      attachmentProps?.timestamp,
      attachmentProps?.serverTimestamp,
      attachmentProps?.sender,
      attachmentProps?.convoId,
    ]
  );

  if (!attachmentProps) {
    return null;
  }

  const { attachments, direction, isTrustedForAttachmentDownload } = attachmentProps;

  if (!attachments || !attachments[0]) {
    return null;
  }

  const firstAttachment = attachments[0];
  const displayImage = canDisplayImage(attachments);

  if (!isTrustedForAttachmentDownload) {
    return <ClickToTrustSender messageId={messageId} />;
  }

  if (
    displayImage &&
    !imageBroken &&
    ((isImage(attachments) && hasImage(attachments)) ||
      (isVideo(attachments) && hasVideoScreenshot(attachments)))
  ) {
    return (
      <StyledMessageHighlighter highlight={highlight}>
        <StyledAttachmentContainer messageDirection={direction}>
          <ImageGrid
            attachments={attachments}
            onError={handleImageError}
            onClickAttachment={onClickOnImageGrid}
          />
        </StyledAttachmentContainer>
      </StyledMessageHighlighter>
    );
  }

  if (!firstAttachment.pending && !firstAttachment.error && isAudio(attachments)) {
    return (
      <StyledMessageHighlighter
        highlight={highlight}
        role="main"
        onClick={(e: any) => {
          if (multiSelectMode) {
            dispatch(toggleSelectedMessageId(messageId));
          }
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <AudioPlayerWithEncryptedFile
          src={firstAttachment.url}
          contentType={firstAttachment.contentType}
          messageId={messageId}
        />
      </StyledMessageHighlighter>
    );
  }
  const { pending, fileName, fileSize, contentType } = firstAttachment;
  const extension = getExtensionForDisplay({ contentType, fileName });

  return (
    <StyledMessageHighlighter highlight={highlight} className="module-message__generic-attachment">
      {pending ? (
        <div className="module-message__generic-attachment__spinner-container">
          <Spinner size="small" />
        </div>
      ) : (
        <div className="module-message__generic-attachment__icon-container">
          <div
            role="button"
            className="module-message__generic-attachment__icon"
            onClick={onClickOnGenericAttachment}
          >
            {extension ? (
              <div className="module-message__generic-attachment__icon__extension">{extension}</div>
            ) : null}
          </div>
        </div>
      )}
      <div className="module-message__generic-attachment__text">
        <div
          className={classNames(
            'module-message__generic-attachment__file-name',
            `module-message__generic-attachment__file-name--${direction}`
          )}
        >
          {fileName}
        </div>
        <div
          className={classNames(
            'module-message__generic-attachment__file-size',
            `module-message__generic-attachment__file-size--${direction}`
          )}
        >
          {fileSize}
        </div>
      </div>
    </StyledMessageHighlighter>
  );
};

function attachmentIsAttachmentTypeWithPath(attac: any): attac is AttachmentTypeWithPath {
  return attac.path !== undefined;
}

const onClickAttachment = async (onClickProps: {
  attachment: AttachmentTypeWithPath | AttachmentType;
  messageId: string;
}) => {
  let index = -1;

  const found = await Data.getMessageById(onClickProps.messageId);
  if (!found) {
    window.log.warn('Such message not found');
    return;
  }
  const msgAttachments = found.getPropsForMessage().attachments;

  const media = (msgAttachments || []).map(attachmentForMedia => {
    index++;
    const messageTimestamp =
      found.get('timestamp') || found.get('serverTimestamp') || found.get('received_at');

    return {
      index: clone(index),
      objectURL: attachmentForMedia.url || undefined,
      contentType: attachmentForMedia.contentType,
      attachment: attachmentForMedia,
      messageSender: found.getSource(),
      messageTimestamp,
      messageId: onClickProps.messageId,
    };
  });

  if (attachmentIsAttachmentTypeWithPath(onClickProps.attachment)) {
    const lightBoxOptions: LightBoxOptions = {
      media: media as any,
      attachment: onClickProps.attachment,
    };
    window.inboxStore?.dispatch(showLightBox(lightBoxOptions));
  } else {
    window.log.warn('Attachment is not of the right type');
  }
};
