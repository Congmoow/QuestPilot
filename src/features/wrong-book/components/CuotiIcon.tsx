import type { ImgHTMLAttributes } from 'react';
import { getPublicAssetPath } from '../../../lib/assets';

type CuotiIconProps = ImgHTMLAttributes<HTMLImageElement> & {
  size?: number;
};

const CuotiIcon = ({ size = 44, ...props }: CuotiIconProps) => (
  <img
    src={getPublicAssetPath('/cuoti-icon.webp')}
    alt="错题本"
    width={size}
    height={size}
    {...props}
  />
);

export default CuotiIcon;
