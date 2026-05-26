import courtIcon from '../../assets/court.png';
import groupIcon from '../../assets/group.png';
import homeIcon from '../../assets/home.png';
import locationPinIcon from '../../assets/location_pin.png';
import magnifierIcon from '../../assets/magnifier.png';
import notificationBellIcon from '../../assets/notification_bell.png';
import paddlesBallIcon from '../../assets/paddles_ball.png';
import profileIcon from '../../assets/profile.png';

interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  className?: string;
  onClick?: () => void;
}

const assetIcons: Record<string, string> = {
  home: homeIcon,
  location_on: locationPinIcon,
  add_location: locationPinIcon,
  my_location: locationPinIcon,
  search: magnifierIcon,
  notifications: notificationBellIcon,
  sports_tennis: paddlesBallIcon,
  group: groupIcon,
  groups: groupIcon,
  group_add: groupIcon,
  person_add: groupIcon,
  person: profileIcon,
  profile: profileIcon,
  map: courtIcon,
  court: courtIcon,
};

export function Icon({ name, size = 24, filled = false, weight = 400, className = '', onClick }: IconProps) {
  const asset = assetIcons[name];

  if (asset) {
    return (
      <img
        alt=""
        src={asset}
        className={`${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          flexShrink: 0,
        }}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      />
    );
  }

  return (
    <span
      className={`material-symbols-outlined ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size <= 20 ? 20 : 24}`,
        width: size,
        height: size,
        lineHeight: 1,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {name}
    </span>
  );
}
